exports.validate_email = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

exports.validate_IIIT_mail = (email) => {
    return email.endsWith("@iiit.ac.in") || email.endsWith("@research.iiit.ac.in") || email.endsWith("@students.iiit.ac.in") || email.endsWith("@alumni.iiit.ac.in");
};

exports.validate_password = (password) => {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/.test(password);
};

