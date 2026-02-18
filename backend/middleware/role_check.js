exports.restrict_to = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user_type)) {
            return res.status(403).json({ message: `User role '${req.user_type}' is not authorized` });
        }
        next();
    };
};