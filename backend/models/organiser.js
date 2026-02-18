const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const organiser_schema = new mongoose.Schema({
    organiser_name: {type: String, required: true},
    category: {type: String, required: true, enum: ["Technical", "Cultural", "Sports", "Literary", "Social Service", "Other"]},
    description: {type: String, required: true},
    contact_email: {type: String, unique: true, required: true, lowercase: true, trim: true},
    contact_number: String,
    password: {type: String, required: true},
    discord_webhook: String,
    is_active: {type: Boolean, default: true},
    reset_password_token: String,
    reset_password_expire: Date,
}, {timestamps: true});

organiser_schema.pre("save", async function() {
    if (!this.isModified("password")) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

organiser_schema.methods.match_password = async function(entered_password) {
    return await bcrypt.compare(entered_password, this.password);
};

module.exports = mongoose.model("Organiser", organiser_schema);