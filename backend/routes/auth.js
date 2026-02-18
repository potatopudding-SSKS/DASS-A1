const express = require("express");
const jwt = require("jsonwebtoken");
const Organiser = require("../models/organiser");
const User = require("../models/user");
const { protect } = require("../middleware/auth");
const { validate_IIIT_mail } = require("../utils/validators");

const router = express.Router();

const generate_token = (id, type) => jwt.sign({ id, type }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE });

router.post("/signup/participant", async (req, res) => {
    try {
        const { first_name, last_name, email, password, participant_type, college, contact_number } = req.body;

        if (!first_name || !last_name || !email || !password || !participant_type) {
            return res.status(400).json({ message: "Required fields are missing" });
        }

        if (participant_type === "IIIT" && !validate_IIIT_mail(email)) {
            return res.status(400).json({ message: "IIIT participants must use IIIT email domain" });
        }

        const existing_user = await User.findOne({ email: email.toLowerCase() });
        if (existing_user) {
            return res.status(400).json({ message: "User already exists" });
        }

        const user = await User.create({
            first_name,
            last_name,
            email,
            password,
            participant_type,
            college,
            contact_number,
            role: "participant"
        });

        return res.status(201).json({
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            user_type: "participant",
            token: generate_token(user._id, "participant")
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password, user_type } = req.body;

        if (!email || !password || !user_type) {
            return res.status(400).json({ message: "Email, password and user_type are required" });
        }

        if (user_type === "organiser") {
            const organiser = await Organiser.findOne({ contact_email: email.toLowerCase() });
            if (!organiser || !(await organiser.match_password(password))) {
                return res.status(401).json({ message: "Invalid credentials" });
            }
            if (!organiser.is_active) {
                return res.status(403).json({ message: "Organiser account is inactive" });
            }
            return res.json({
                _id: organiser._id,
                organiser_name: organiser.organiser_name,
                email: organiser.contact_email,
                user_type: "organiser",
                role: "organiser",
                token: generate_token(organiser._id, "organiser")
            });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user || !(await user.match_password(password))) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const resolved_type = user.role === "admin" ? "admin" : "participant";
        return res.json({
            _id: user._id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            role: user.role,
            user_type: resolved_type,
            token: generate_token(user._id, resolved_type)
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
});

router.get("/me", protect, (req, res) => {
    return res.json({ ...req.user.toObject(), user_type: req.user_type });
});

module.exports = router;