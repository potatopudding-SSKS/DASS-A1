const express = require("express");
const router = express.Router();

const Event = require("../models/event");
const Registration = require("../models/registration");
const { protect } = require("../middleware/auth");
const { restrict_to } = require("../middleware/role_check");
const { generate_qr_code } = require("../utils/qr_generator");
const { send_email } = require("../utils/email_service");

router.post("/", protect, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can register" });
        }

        const { event_id, form_responses, merch_details, team_id } = req.body;
        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        if (!["Published", "Ongoing"].includes(event.status)) {
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
        return res.json(registrations);
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
