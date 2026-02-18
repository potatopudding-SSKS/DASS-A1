const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

exports.send_email = async (options) => {
    try {
        await transporter.sendMail({
            from: `Event Management <${process.env.EMAIL_USER}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        });
        console.log(`Mail sent to ${options.to}`);
    } catch (error) {
        console.error(`Email send error: ${error.message}`);
        throw error;
    }
};