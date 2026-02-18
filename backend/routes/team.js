const express = require("express");
const router = express.Router();

const Team = require("../models/team");
const Event = require("../models/event");
const Registration = require("../models/registration");
const { protect } = require("../middleware/auth");
const { generate_qr_code } = require("../utils/qr_generator");

const ensure_team_completion_registrations = async (team) => {
    if (team.status !== "Complete") {
        return;
    }

    const event = await Event.findById(team.event);
    if (!event) {
        return;
    }

    const accepted_member_ids = team.members
        .filter((member) => member.status === "Accepted")
        .map((member) => member.user);

    await Promise.all(accepted_member_ids.map(async (member_id) => {
        const existing = await Registration.findOne({ event: event._id, participant: member_id, status: { $ne: "Cancelled" } });
        if (existing) {
            if (!existing.team) {
                existing.team = team._id;
                existing.team_name = team.team_name;
                await existing.save();
            }
            return;
        }

        const ticket_id = `TKT-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const qr_code = await generate_qr_code({
            ticket_id,
            event_id: event._id,
            participant_id: member_id,
            team_id: team._id,
            team_name: team.team_name
        });

        await Registration.create({
            event: event._id,
            participant: member_id,
            status: "Registered",
            payment_status: event.registration_fee > 0 ? "Pending" : "NotRequired",
            payment_amount: event.registration_fee,
            ticket_id,
            qr_code: event.registration_fee > 0 ? null : qr_code,
            team: team._id,
            team_name: team.team_name
        });

        event.total_registration += 1;
    }));

    await event.save();
};

router.post("/", protect, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can create teams" });
        }

        const { event_id, team_name, team_size } = req.body;
        const event = await Event.findById(event_id);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }

        const existing_team = await Team.findOne({
            event: event_id,
            "members.user": req.user._id,
            status: { $ne: "Cancelled" }
        });
        if (existing_team) {
            return res.status(400).json({ message: "You are already in a team for this event" });
        }

        const team = await Team.create({
            event: event_id,
            team_name,
            team_leader: req.user._id,
            team_size,
            members: [{
                user: req.user._id,
                status: "Accepted",
                joined_at: new Date()
            }],
            status: team_size === 1 ? "Complete" : "Forming"
        });

        if (team_size === 1) {
            team.completed_at = new Date();
            await team.save();
            await ensure_team_completion_registrations(team);
        }

        return res.status(201).json(team);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post("/:team_id/invite", protect, async (req, res) => {
    try {
        const team = await Team.findById(req.params.team_id);
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }
        if (team.team_leader.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Only team leader can invite" });
        }

        return res.json({
            invite_code: team.invite_code,
            invite_link: `${process.env.FRONTEND_URL || "http://localhost:3000"}/participant/team/join/${team.invite_code}`
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post("/join", protect, async (req, res) => {
    try {
        if (req.user_type !== "participant") {
            return res.status(403).json({ message: "Only participants can join teams" });
        }

        const { invite_code } = req.body;
        const team = await Team.findOne({ invite_code });
        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }
        if (team.status !== "Forming") {
            return res.status(400).json({ message: "Team is not open for joining" });
        }

        const duplicate_event_team = await Team.findOne({
            event: team.event,
            "members.user": req.user._id,
            status: { $ne: "Cancelled" }
        });
        if (duplicate_event_team) {
            return res.status(400).json({ message: "You already joined a team for this event" });
        }

        if (team.members.length >= team.team_size) {
            return res.status(400).json({ message: "Team is at capacity" });
        }

        team.members.push({
            user: req.user._id,
            status: "Accepted",
            joined_at: new Date()
        });

        if (team.members.filter((member) => member.status === "Accepted").length >= team.team_size) {
            team.status = "Complete";
            team.completed_at = new Date();
        }

        await team.save();
        await ensure_team_completion_registrations(team);

        return res.json({ message: "Joined team successfully", team });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/my-teams", protect, async (req, res) => {
    try {
        const teams = await Team.find({ "members.user": req.user._id })
            .populate("event", "event_name")
            .populate("members.user", "first_name last_name email")
            .populate("team_leader", "first_name last_name email")
            .sort({ createdAt: -1 });

        return res.json(teams);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/:id", protect, async (req, res) => {
    try {
        const team = await Team.findById(req.params.id)
            .populate("members.user", "first_name last_name email")
            .populate("team_leader", "first_name last_name email")
            .populate("event", "event_name event_start_date registration_deadline");

        if (!team) {
            return res.status(404).json({ message: "Team not found" });
        }

        return res.json(team);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
