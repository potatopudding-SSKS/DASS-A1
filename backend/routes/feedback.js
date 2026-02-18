const express = require("express");
const router = express.Router();

const Feedback = require("../models/feedback");
const Event = require("../models/event");
const Registration = require("../models/registration");
const { protect } = require("../middleware/auth");
const { restrict_to } = require("../middleware/role_check");

router.post("/", protect, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can submit feedback" });
        }

        const { event_id, rating, comments } = req.body;
        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const participated = await Registration.findOne({
            event: event_id,
            participant: req.user._id,
            status: { $in: ["Registered", "Attended"] }
        });
        if (!participated) {
            return res.status(400).json({ message: "You can only submit feedback for events you participated in" });
        }

        const feedback = await Feedback.create({
            event: event_id,
            rating,
            comments,
            submitted_at: new Date()
        });

        return res.status(201).json({ message: "Feedback submitted anonymously", feedback });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/event/:event_id", protect, restrict_to("organiser"), async (req, res) => {
    try {
        const event = await Event.findById(req.params.event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const filter = { event: req.params.event_id };
        if (req.query.rating) {
            filter.rating = Number(req.query.rating);
        }

        const feedbacks = await Feedback.find(filter).sort({ submitted_at: -1 });
        const avg_rating = feedbacks.length
            ? Number((feedbacks.reduce((sum, item) => sum + item.rating, 0) / feedbacks.length).toFixed(1))
            : 0;

        return res.json({
            avg_rating,
            total_count: feedbacks.length,
            feedbacks
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
