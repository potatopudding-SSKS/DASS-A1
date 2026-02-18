const express = require("express");
const router = express.Router();

const Discussion = require("../models/discussion");
const Event = require("../models/event");
const { protect } = require("../middleware/auth");

router.post("/", protect, async (req, res) => {
    try {
        const { event_id, message_type, content, parent_message } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Content is required" });
        }

        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        let parent = null;
        if (parent_message) {
            parent = await Discussion.findById(parent_message);
            if (!parent || parent.event.toString() !== event_id.toString()) {
                return res.status(400).json({ message: "Invalid parent message" });
            }
        }

        const discussion = await Discussion.create({
            event: event_id,
            participant: req.user._id,
            message_type: parent_message ? "Reply" : (message_type || "Question"),
            content: content.trim(),
            parent_message: parent_message || null
        });

        const populated_discussion = await Discussion.findById(discussion._id).populate("participant", "first_name last_name organiser_name");
        return res.status(201).json(populated_discussion);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/event/:event_id", protect, async (req, res) => {
    try {
        const messages = await Discussion.find({ event: req.params.event_id })
            .populate("participant", "first_name last_name organiser_name")
            .sort({ is_pinned: -1, createdAt: -1 });

        return res.json(messages);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/:id/toggle-pin", protect, async (req, res) => {
    try {
        const message = await Discussion.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const event = await Event.findById(message.event);
        if (!event || event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        message.is_pinned = !message.is_pinned;
        await message.save();

        return res.json(message);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/:id/react", protect, async (req, res) => {
    try {
        const { emoji } = req.body;
        const message = await Discussion.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const existing_index = message.reactions.findIndex((reaction) => reaction.user.toString() === req.user._id.toString());
        if (existing_index >= 0) {
            message.reactions[existing_index].emoji = emoji;
        } else {
            message.reactions.push({ user: req.user._id, emoji });
        }

        await message.save();
        return res.json(message);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.delete("/:id", protect, async (req, res) => {
    try {
        const message = await Discussion.findById(req.params.id);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        const is_author = message.participant.toString() === req.user._id.toString();
        const event = await Event.findById(message.event);
        const is_organiser = event && event.organiser.toString() === req.user._id.toString();

        if (!is_author && !is_organiser) {
            return res.status(403).json({ message: "Not authorized" });
        }

        message.is_deleted = true;
        message.content = "[This message was deleted]";
        await message.save();

        return res.json({ message: "Message deleted" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
