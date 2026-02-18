const express = require("express");
const router = express.Router();
const Event = require("../models/event");
const Registration = require("../models/registration");
const Organiser = require("../models/organiser");
const {protect} = require("../middleware/auth");
const {restrict_to} = require("../middleware/role_check");

const escape_regex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req, res) => {
    try {
        const { keyword, event_type, eligibility, status, from_date, to_date, organiser_id } = req.query;
        let query = { status: { $in: ["Published", "Ongoing", "Completed"] } };

        if (status) {
            query.status = status;
        }
        if (keyword) {
            const safe_keyword = keyword.trim();
            const escaped = escape_regex(safe_keyword);
            const fuzzy_pattern = escaped.split("").join(".*");

            const matching_organisers = await Organiser.find({
                organiser_name: { $regex: escaped, $options: "i" }
            }).select("_id");

            const organiser_ids = matching_organisers.map((organiser) => organiser._id);
            query.$or = [
                { event_name: { $regex: escaped, $options: "i" } },
                { event_name: { $regex: fuzzy_pattern, $options: "i" } },
                { event_description: { $regex: escaped, $options: "i" } },
                { organiser: { $in: organiser_ids } }
            ];
        }
        if (event_type) query.event_type = event_type;
        if (eligibility) query.eligibility = eligibility;
        if (organiser_id) query.organiser = organiser_id;
        if (from_date || to_date) {
            query.event_start_date = {};
            if (from_date) query.event_start_date.$gte = new Date(from_date);
            if (to_date) query.event_start_date.$lte = new Date(to_date);
        }

        const events = await Event.find(query)
            .populate("organiser", "organiser_name category")
            .sort({event_start_date: 1});
        return res.json(events);
    } catch (error) {
        return res.status(500).json({message: error.message});
    }
});

router.get("/trending", async (req, res) => {
    try {
        const from = new Date(Date.now() - (24 * 60 * 60 * 1000));

        const trending_rows = await Registration.aggregate([
            {
                $match: {
                    createdAt: { $gte: from },
                    status: { $nin: ["Cancelled", "Rejected"] }
                }
            },
            { $group: { _id: "$event", registrations_24h: { $sum: 1 } } },
            { $sort: { registrations_24h: -1 } },
            { $limit: 5 }
        ]);

        const event_ids = trending_rows.map((row) => row._id);
        const events = await Event.find({ _id: { $in: event_ids }, status: { $in: ["Published", "Ongoing", "Completed"] } })
            .populate("organiser", "organiser_name");

        const by_id = new Map(events.map((event) => [event._id.toString(), event]));
        const ordered = trending_rows
            .map((row) => {
                const event = by_id.get(row._id.toString());
                if (!event) return null;
                const event_obj = event.toObject();
                event_obj.registrations_24h = row.registrations_24h;
                return event_obj;
            })
            .filter(Boolean);

        return res.json(ordered);
    } catch (error) {
        return res.status(500).json({message: error.message});
    }
});

router.get("/my-events", protect, restrict_to("organiser"), async (req, res) => {
    try {
        const events = await Event.find({organiser: req.user._id}).sort({createdAt: -1});
        return res.json(events);
    } catch (error) {
        return res.status(500).json({message: error.message});
    }
});

router.get("/my-events/:id/analytics", protect, restrict_to("organiser"), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const [registrations, attended] = await Promise.all([
            Registration.countDocuments({ event: event._id, status: { $nin: ["Cancelled", "Rejected"] } }),
            Registration.countDocuments({ event: event._id, status: "Attended" })
        ]);

        return res.json({
            registrations,
            attended,
            revenue: event.total_revenue,
            event_status: event.status
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


router.get('/:id', async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('organiser', 'organiser_name contact_email description');
        if (!event) {
            return res.status(404).json({message: 'Event not found'});
        }
        return res.json(event);
    } catch (error) {
        return res.status(500).json({message: error.message});
    }
});


router.post('/', protect, restrict_to('organiser'), async (req, res) => {
    try {
        req.body.organiser = req.user._id;
        const event = await Event.create(req.body);
        return res.status(201).json(event);
    } catch (error) {
        return res.status(400).json({message: error.message});
    }
});


router.put('/:id', protect, restrict_to('organiser'), async (req, res) => {
    try {
        let event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({message: 'Not authorized to update this event'});
        }
        if (["Ongoing", "Completed", "Closed"].includes(event.status)) {
            return res.status(400).json({ message: "Event in current state cannot be edited" });
        }
        event = await Event.findByIdAndUpdate(req.params.id, req.body, {new: true, runValidators: true});
        return res.json(event);
    } catch (error) {
        return res.status(400).json({message: error.message});
    }
});

router.put('/:id/publish', protect, restrict_to('organiser'), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }
        if (event.status !== "Draft") {
            return res.status(400).json({ message: "Only draft events can be published" });
        }
        event.status = "Published";
        await event.save();
        return res.json(event);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put('/:id/status', protect, restrict_to('organiser'), async (req, res) => {
    try {
        const { status } = req.body;
        const allowed = ["Draft", "Published", "Ongoing", "Completed", "Closed"];
        if (!allowed.includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        event.status = status;
        await event.save();
        return res.json(event);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});


router.delete('/:id', protect, restrict_to('organiser'), async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) {
            return res.status(404).json({ message:'Event not found'});
        }
        if (event.organiser.toString() !== req.user._id.toString()) {
            return res.status(403).json({message: 'Not authorized to delete this event'});
        }
        await event.deleteOne();
        return res.json({message: 'Event removed'});
    } catch (error) {
        return res.status(500).json({message: error.message});
    }
});

module.exports = router;