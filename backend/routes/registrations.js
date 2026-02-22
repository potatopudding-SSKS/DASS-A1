const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const Event = require("../models/event");
const Registration = require("../models/registration");
const { protect } = require("../middleware/auth");
const { restrict_to } = require("../middleware/role_check");
const { generate_qr_code } = require("../utils/qr_generator");
const { send_email } = require("../utils/email_service");
const { resolve_event_status } = require("../utils/event_status");

const registration_file_storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = "uploads/form-responses";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const safe_name = file.originalname.replace(/\s+/g, "-");
        cb(null, `form-${Date.now()}-${safe_name}`);
    }
});

const upload_registration_files = multer({
    storage: registration_file_storage,
    limits: { fileSize: 10 * 1024 * 1024 }
}).any();

const parse_registration_uploads = (req, res, next) => {
    upload_registration_files(req, res, (err) => {
        if (!err) {
            return next();
        }

        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({ message: "File too large. Maximum allowed size is 10MB." });
        }

        return res.status(400).json({ message: err.message || "Invalid upload" });
    });
};

const parse_form_responses = (raw_responses) => {
    if (!raw_responses) return [];
    if (Array.isArray(raw_responses)) return raw_responses;
    if (typeof raw_responses === "string") {
        try {
            const parsed = JSON.parse(raw_responses);
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }
    return [];
};

const parse_merch_details = (raw_merch_details) => {
    if (!raw_merch_details) return null;
    if (typeof raw_merch_details === "object") return raw_merch_details;
    if (typeof raw_merch_details === "string") {
        try {
            return JSON.parse(raw_merch_details);
        } catch (error) {
            return null;
        }
    }
    return null;
};

router.post("/", protect, parse_registration_uploads, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can register" });
        }

        const { event_id, team_id } = req.body;
        const merch_details = parse_merch_details(req.body.merch_details);
        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const effective_event_status = resolve_event_status(event);
        if (!["Published", "Ongoing"].includes(effective_event_status)) {
            return res.status(400).json({ message: "Event is not open for registration" });
        }

        if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
            return res.status(400).json({ message: "Registration deadline has passed" });
        }

        if (event.eligibility === "IIIT-Only" && req.user.participant_type !== "IIIT") {
            return res.status(403).json({ message: "This event is IIIT only" });
        }
        if (event.eligibility === "Non-IIIT-Only" && req.user.participant_type !== "Non-IIIT") {
            return res.status(403).json({ message: "This event is Non-IIIT only" });
        }

        const existing_reg = await Registration.findOne({
            event: event_id,
            participant: req.user._id,
            status: { $ne: "Cancelled" }
        });
        if (existing_reg) {
            return res.status(400).json({ message: "You are already registered to this event" });
        }

        if (event.registration_limit && event.total_registration >= event.registration_limit) {
            return res.status(400).json({ message: "Event is full" });
        }

        if (event.event_type === "Merchandise") {
            const requested_qty = merch_details?.quantity || 1;
            if ((event.merch_details?.stock_quantity || 0) < requested_qty) {
                return res.status(400).json({ message: "Stock exhausted" });
            }
        }

        const existing_form_responses = parse_form_responses(req.body.form_responses);
        const response_map = new Map(
            existing_form_responses
                .filter((entry) => entry?.field_label)
                .map((entry) => [entry.field_label, entry.field_value])
        );

        for (const uploaded_file of (req.files || [])) {
            const field_label = uploaded_file.fieldname.replace(/^file:/, "").trim();
            response_map.set(field_label, `/${uploaded_file.path.replace(/\\/g, "/")}`);
        }

        for (const field of (event.custom_form_fields || [])) {
            if (!field.is_required) continue;
            const value = response_map.get(field.field_label);
            const is_empty = value === undefined || value === null || (typeof value === "string" && !value.trim());
            if (is_empty) {
                return res.status(400).json({ message: `Missing required field: ${field.field_label}` });
            }
        }

        const form_responses = Array.from(response_map.entries()).map(([field_label, field_value]) => ({
            field_label,
            field_value
        }));

        const is_paid_event = event.registration_fee > 0;
        const ticket_id = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const qr_code = is_paid_event
            ? null
            : await generate_qr_code({
                ticket_id,
                event_id,
                participant_id: req.user._id,
                name: `${req.user.first_name} ${req.user.last_name}`
            });

        const registration = await Registration.create({
            event: event_id,
            participant: req.user._id,
            form_responses,
            merchandise_details: merch_details,
            team: team_id || null,
            status: "Registered",
            payment_status: is_paid_event ? "Pending" : "NotRequired",
            payment_amount: event.registration_fee,
            ticket_id,
            qr_code
        });

        event.total_registration += 1;
        await event.save();

        if (!is_paid_event) {
            const email_html = `<h1>Registration Confirmed</h1>
                <p>You have successfully registered for <strong>${event.event_name}</strong>.</p>
                <p><strong>Ticket ID:</strong> ${ticket_id}</p>
                <img src="${qr_code}" alt="Event Ticket QR" />`;
            await send_email({
                to: req.user.email,
                subject: `Ticket for ${event.event_name}`,
                html: email_html
            });
        }

        return res.status(201).json(registration);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/my-registrations", protect, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can access registration history" });
        }

        const registrations = await Registration.find({ participant: req.user._id })
            .populate("event", "event_name event_start_date event_end_date status event_type organiser")
            .sort({ createdAt: -1 });

        const enriched = registrations.map((registration) => {
            const registration_obj = registration.toObject();
            if (registration_obj.event) {
                registration_obj.event.status = resolve_event_status(registration_obj.event);
            }
            return registration_obj;
        });

        return res.json(enriched);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/event/:event_id", protect, restrict_to("organiser", "admin"), async (req, res) => {
    try {
        const event = await Event.findById(req.params.event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        if (req.user_type === "organiser" && event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const registrations = await Registration.find({ event: req.params.event_id })
            .populate("participant", "first_name last_name email")
            .sort({ createdAt: -1 });
        return res.json(registrations);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/:id", protect, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id)
            .populate("event")
            .populate("participant", "first_name last_name email");
        if (!registration) {
            return res.status(404).json({ message: "Registration not found" });
        }

        const is_owner = registration.participant._id.toString() === req.user._id.toString();
        const is_admin = req.user_type === "admin";
        if (!is_owner && !is_admin) {
            return res.status(403).json({ message: "Not authorized" });
        }

        return res.json(registration);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/:id/cancel", protect, async (req, res) => {
    try {
        const registration = await Registration.findById(req.params.id);
        if (!registration) {
            return res.status(404).json({ message: "Registration not found" });
        }
        if (registration.participant.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        registration.status = "Cancelled";
        await registration.save();

        const event = await Event.findById(registration.event);
        if (event) {
            event.total_registration = Math.max(0, event.total_registration - 1);
            await event.save();
        }

        return res.json({ message: "Registration cancelled", registration });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
