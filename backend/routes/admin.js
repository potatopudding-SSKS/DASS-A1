const express = require("express");
const router = express.Router();

const User = require("../models/user");
const Organiser = require("../models/organiser");
const Event = require("../models/event");
const Registration = require("../models/registration");
const Payment = require("../models/payment");
const Team = require("../models/team");
const Feedback = require("../models/feedback");
const Discussion = require("../models/discussion");
const Password_reset = require("../models/password_reset");
const { protect } = require("../middleware/auth");
const { restrict_to } = require("../middleware/role_check");

router.use(protect);
router.use(restrict_to("admin"));

router.post("/organisers", async (req, res) => {
    try {
        const { organiser_name, category, description, contact_email, contact_number, password } = req.body;
        const exists = await Organiser.findOne({ contact_email: contact_email?.toLowerCase() });
        if (exists) {
            return res.status(400).json({ message: "Organiser email already exists" });
        }

        const organiser = await Organiser.create({
            organiser_name,
            category,
            description,
            contact_email,
            contact_number,
            password
        });

        organiser.password = undefined;
        return res.status(201).json(organiser);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/organisers", async (req, res) => {
    try {
        const organisers = await Organiser.find().select("-password").sort({ createdAt: -1 });
        return res.json(organisers);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/organisers/:id/status", async (req, res) => {
    try {
        const { is_active } = req.body;
        const organiser = await Organiser.findByIdAndUpdate(
            req.params.id,
            { is_active: Boolean(is_active) },
            { new: true }
        ).select("-password");

        if (!organiser) {
            return res.status(404).json({ message: "Organiser not found" });
        }

        return res.json(organiser);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.delete("/organisers/:id", async (req, res) => {
    try {
        const organiser_id = req.params.id;
        const organiser = await Organiser.findById(organiser_id);
        if (!organiser) {
            return res.status(404).json({ message: "Organiser not found" });
        }

        const events = await Event.find({ organiser: organiser_id }).select("_id");
        const event_ids = events.map((event) => event._id);

        if (event_ids.length) {
            await Promise.all([
                Registration.deleteMany({ event: { $in: event_ids } }),
                Payment.deleteMany({ event: { $in: event_ids } }),
                Team.deleteMany({ event: { $in: event_ids } }),
                Feedback.deleteMany({ event: { $in: event_ids } }),
                Discussion.deleteMany({ event: { $in: event_ids } })
            ]);
            await Event.deleteMany({ _id: { $in: event_ids } });
        }

        await Promise.all([
            Password_reset.deleteMany({ organiser: organiser_id }),
            User.updateMany({}, { $pull: { followed_clubs: organiser_id } })
        ]);

        await organiser.deleteOne();
        return res.json({ message: "Organiser and associated data deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/stats", async (req, res) => {
    try {
        const [participant_count, organiser_count, event_count, registration_count, revenue_agg, pending_password_resets] = await Promise.all([
            User.countDocuments({ role: "participant" }),
            Organiser.countDocuments(),
            Event.countDocuments(),
            Registration.countDocuments(),
            Event.aggregate([{ $group: { _id: null, total: { $sum: "$total_revenue" } } }]),
            Password_reset.countDocuments({ status: "Pending" })
        ]);

        return res.json({
            participant_count,
            organiser_count,
            event_count,
            registration_count,
            total_revenue: revenue_agg.length ? revenue_agg[0].total : 0,
            pending_password_resets
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
