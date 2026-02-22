exports.validate_email = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

exports.validate_IIIT_mail = (email) => {
    return typeof email === "string" && email.toLowerCase().endsWith("iiit.ac.in");
};

exports.validate_password = (password) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);
};

