const express = require("express");
const router = express.Router();

const Password_reset = require("../models/password_reset");
const Organiser = require("../models/organiser");
const { protect } = require("../middleware/auth");
const { restrict_to } = require("../middleware/role_check");
const { send_email } = require("../utils/email_service");

router.post("/request", async (req, res) => {
    try {
        const { contact_email, reason } = req.body;
        const organiser = await Organiser.findOne({ contact_email: contact_email?.toLowerCase() });
        if (!organiser) {
            return res.status(404).json({ message: "Organiser email not found" });
        }

        const pending = await Password_reset.findOne({ organiser: organiser._id, status: "Pending" });
        if (pending) {
            return res.status(400).json({ message: "A reset request is already pending" });
        }

        await Password_reset.create({
            organiser: organiser._id,
            club_name: organiser.organiser_name,
            reason
        });

        return res.status(201).json({ message: "Request submitted to admin" });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/pending", protect, restrict_to("admin"), async (req, res) => {
    try {
        const requests = await Password_reset.find({ status: "Pending" })
            .populate("organiser", "organiser_name contact_email")
            .sort({ createdAt: -1 });

        return res.json(requests);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/history", protect, restrict_to("admin"), async (req, res) => {
    try {
        const requests = await Password_reset.find()
            .populate("organiser", "organiser_name contact_email")
            .sort({ createdAt: -1 });
        return res.json(requests);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/:id/review", protect, restrict_to("admin"), async (req, res) => {
    try {
        const { status, admin_comments } = req.body;
        if (!["Approved", "Rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const request = await Password_reset.findById(req.params.id).populate("organiser");
        if (!request) {
            return res.status(404).json({ message: "Request not found" });
        }
        if (request.status !== "Pending") {
            return res.status(400).json({ message: "Request already processed" });
        }

        request.status = status;
        request.reviewed_by = req.user._id;
        request.reviewed_at = new Date();
        request.admin_comments = admin_comments;

        if (status === "Approved") {
            const temp_password = `${Math.random().toString(36).slice(-6)}Aa1!`;
            const organiser = await Organiser.findById(request.organiser._id);
            organiser.password = temp_password;
            await organiser.save();

            request.new_password = temp_password;

            await send_email({
                to: organiser.contact_email,
                subject: "Password Reset Approved",
                html: `<p>Your request has been approved.</p><p>Temporary password: <strong>${temp_password}</strong></p><p>Please change it after login.</p><p>Admin comments: ${admin_comments || "None"}</p>`
            });
        } else {
            await send_email({
                to: request.organiser.contact_email,
                subject: "Password Reset Rejected",
                html: `<p>Your password reset request was rejected.</p><p>Reason: ${admin_comments || "No comments"}</p>`
            });
        }

        await request.save();
        return res.json({ message: `Request ${status.toLowerCase()}`, request });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;
