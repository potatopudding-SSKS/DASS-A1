const jwt = require("jsonwebtoken");
const User = require("../models/user");
const Organiser = require("../models/organiser");

exports.protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
        return res.status(401).json({ message: "Not authorized, no token" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type === "organiser") {
            req.user = await Organiser.findById(decoded.id).select("-password");
            req.user_type = "organiser";
        } else {
            req.user = await User.findById(decoded.id).select("-password");
            req.user_type = decoded.type;
        }

        if (!req.user) {
            return res.status(401).json({ message: "User not found" });
        }

        next();
    } catch (error) {
        return res.status(401).json({ message: "Not authorized, token failed" });
    }
};