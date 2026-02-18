const express = require("express");
const router = express.Router();
const Organiser = require("../models/organiser");
const Event = require("../models/event");
const {protect} = require("../middleware/auth");
const {restrict_to} = require("../middleware/role_check");

router.get("/profile", protect, restrict_to("organiser"), async (req, res) => {
    try {
        res.json(req.user);
    } catch(error) {
        res.status(500).json({message: error.message});
    }
});

router.put("/profile", protect, restrict_to("organiser"), async (req, res) => {
    try{
        const organiser = await Organiser.findById(req.user._id);
        if (organiser) {
            organiser.organiser_name = req.body.organiser_name || organiser.organiser_name;
            organiser.category = req.body.category || organiser.category;
            organiser.description = req.body.description || organiser.description;
            organiser.contact_number = req.body.contact_number || organiser.contact_number;
            organiser.discord_webhook = req.body.discord_webhook || organiser.discord_webhook;

            if (req.body.password) {
                organiser.password = req.body.password;
            }
            const updated_organiser = await organiser.save();
            updated_organiser.password = undefined;
            res.json(updated_organiser);
        } else {
            res.status(404).json({message: "Organiser not found"});
        }
    } catch(error) {
        res.status(500).json({message: error.message});
    }
});

router.get("/public", async (req, res) => {
    try {
        const organisers = await Organiser.find({ is_active: true }).select("organiser_name category description contact_email");
        return res.json(organisers);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/public/:id", async (req, res) => {
    try {
        const organiser = await Organiser.findById(req.params.id).select("organiser_name category description contact_email");
        if (!organiser) {
            return res.status(404).json({ message: "Organiser not found" });
        }
        const now = new Date();
        const [upcoming_events, past_events] = await Promise.all([
            Event.find({ organiser: req.params.id, event_start_date: { $gte: now }, status: { $in: ["Published", "Ongoing"] } })
                .sort({ event_start_date: 1 })
                .select("event_name event_start_date event_end_date status"),
            Event.find({ organiser: req.params.id, event_end_date: { $lt: now } })
                .sort({ event_end_date: -1 })
                .select("event_name event_start_date event_end_date status")
        ]);

        return res.json({ organiser, upcoming_events, past_events });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;