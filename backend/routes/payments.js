const express = require("express");
const router = express.Router();

const fs = require("fs");
const path = require("path");
const multer = require("multer");

const Registration = require("../models/registration");
const Event = require("../models/event");
const Payment = require("../models/payment");
const { protect } = require("../middleware/auth");
const { restrict_to } = require("../middleware/role_check");
const { generate_qr_code } = require("../utils/qr_generator");
const { send_email } = require("../utils/email_service");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "uploads/payment-proofs";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `proof-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        const ext_ok = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime_ok = allowed.test(file.mimetype);
        if (ext_ok && mime_ok) {
            return cb(null, true);
        }
        return cb(new Error("Images only"));
    }
});

const upload_payment_proof = (req, res, next) => {
    upload.single("paymentProof")(req, res, (err) => {
        if (!err) {
            return next();
        }

        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "File too large. Maximum allowed size is 5MB." });
        }

        return res.status(400).json({ message: err.message || "Invalid upload" });
    });
};

router.post("/", protect, upload_payment_proof, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can upload payment proof" });
        }

        const { registration_id, amount } = req.body;
        const registration = await Registration.findById(registration_id).populate("event");
        if (!registration) {
            return res.status(404).json({ message: "Registration not found" });
        }
        if (registration.participant.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }
        if (!req.file) {
            return res.status(400).json({ message: "Payment proof image is required" });
        }

        const payment = await Payment.create({
            registration: registration._id,
            participant: req.user._id,
            event: registration.event._id,
            amount: amount || registration.payment_amount,
            payment_proof: req.file.path,
            status: "Pending"
        });

        registration.payment_status = "Pending";
        await registration.save();

        return res.status(201).json({ message: "Payment proof uploaded", payment });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/pending", protect, restrict_to("organiser"), async (req, res) => {
    try {
        const events = await Event.find({ organiser: req.user._id }).select("_id event_name event_type status").sort({ event_start_date: 1 });
        const event_ids = events.map((event) => event._id);

        const pending_payments = await Payment.find({ event: { $in: event_ids }, status: "Pending" })
            .populate("participant", "first_name last_name email contact_number")
            .populate("registration")
            .populate("event", "event_name event_type status")
            .sort({ createdAt: -1 });

        const grouped = events.map((event) => ({
            event,
            payments: pending_payments.filter((payment) => payment.event?._id?.toString() === event._id.toString())
        }));

        return res.json(grouped);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/pending/:event_id", protect, restrict_to("organiser"), async (req, res) => {
    try {
        const event = await Event.findById(req.params.event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const payments = await Payment.find({ event: req.params.event_id, status: "Pending" })
            .populate("participant", "first_name last_name email contact_number")
            .populate("registration")
            .sort({ createdAt: -1 });

        return res.json(payments);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/:id/review", protect, restrict_to("organiser"), async (req, res) => {
    try {
        const { status, review_notes } = req.body;
        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const payment = await Payment.findById(req.params.id)
            .populate("event")
            .populate("registration")
            .populate("participant");
        if (!payment) {
            return res.status(404).json({ message: "Payment not found" });
        }
        if (payment.event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        payment.status = status;
        payment.reviewed_by = req.user._id;
        payment.reviewed_at = new Date();
        payment.review_notes = review_notes;
        await payment.save();

        const registration = await Registration.findById(payment.registration._id);
        if (!registration) {
            return res.status(404).json({ message: "Registration not found" });
        }

        if (status === "Approved") {
            registration.payment_status = "Approved";
            registration.status = "Registered";

            if (!registration.qr_code) {
                registration.qr_code = await generate_qr_code({
                    ticket_id: registration.ticket_id,
                    event_id: payment.event._id,
                    participant_id: payment.participant._id,
                    status: "Paid"
                });
            }

            if (payment.event.event_type === "Merchandise") {
                const event = await Event.findById(payment.event._id);
                const quantity = registration.merchandise_details?.quantity || 1;
                if ((event.merch_details?.stock_quantity || 0) < quantity) {
                    return res.status(400).json({ message: "Insufficient stock for approval" });
                }
                event.merch_details.stock_quantity -= quantity;
                event.total_revenue += Number(payment.amount || 0);
                await event.save();
            }

            await send_email({
                to: payment.participant.email,
                subject: `Payment Approved: ${payment.event.event_name}`,
                html: `<p>Your payment has been approved.</p><p>Ticket ID: ${registration.ticket_id}</p><img src="${registration.qr_code}" alt="QR" />`
            });
        } else {
            registration.payment_status = "Rejected";
            await send_email({
                to: payment.participant.email,
                subject: `Payment Rejected: ${payment.event.event_name}`,
                html: `<p>Your payment was rejected.</p><p>Reason: ${review_notes || "No notes provided"}</p>`
            });
        }

        await registration.save();
        return res.json({ message: `Payment ${status}`, payment });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
