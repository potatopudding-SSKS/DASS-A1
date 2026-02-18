const express = require("express");
const router = express.Router();
const User = require("../models/user");
const Organiser = require("../models/organiser");
const {protect} = require("../middleware/auth");
const {restrict_to} = require("../middleware/role_check");

router.get("/profile", protect, restrict_to("participant", "admin"), async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate("followed_clubs", "organiser_name category description");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.json(user);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.put("/profile", protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user) {
            user.first_name = req.body.first_name || user.first_name;
            user.last_name = req.body.last_name || user.last_name;
            user.contact_number = req.body.contact_number || user.contact_number;
            user.college = req.body.college || user.college;
            if (req.body.areas_of_interest) {
                user.areas_of_interest = req.body.areas_of_interest;
            }
            if (req.body.followed_clubs) {
                user.followed_clubs = req.body.followed_clubs;
            }
            if (req.body.password) {
                user.password = req.body.password;
            }
            const updated_user = await user.save();
            res.json({
                _id: updated_user._id,
                first_name: updated_user.first_name,
                last_name: updated_user.last_name,
                email: updated_user.email,
                contact_number: updated_user.contact_number,
                college: updated_user.college,
                participant_type: updated_user.participant_type,
                areas_of_interest: updated_user.areas_of_interest,
                followed_clubs: updated_user.followed_clubs,
                message: "User updated successfully"
            });
        } else {
            res.status(404).json({message: "User not found"});
        }
    } catch (error) {
        res.status(400).json({message: error.message});
    }
});

router.get("/clubs", protect, restrict_to("participant", "admin"), async (req, res) => {
    try {
        const clubs = await Organiser.find({ is_active: true }).select("organiser_name category description contact_email");
        return res.json(clubs);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

module.exports = router;