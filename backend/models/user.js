const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const user_schema = new mongoose.Schema({
    first_name: {type: String, required: true},
    last_name: {type: String, required: true},
    email: {type: String, lowercase: true, unique: true, required: true, trim: true},
    password: {type: String, required: true},
    contact_number: String,
    participant_type: {type: String, enum: ["IIIT", "Non-IIIT"], required: function() {return this.role === "participant";}},
    college: String,
    role: {type: String, enum: ["participant", "admin"], default: "participant"},
    areas_of_interest: [{ type: String }],
    followed_clubs: [{type: mongoose.Schema.Types.ObjectId, ref: "Organiser"}],
    reset_password_token: String,
    reset_password_expire: Date,
}, {timestamps: true});

user_schema.pre("save", async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

user_schema.methods.match_password = async function(entered_password) {
    return await bcrypt.compare(entered_password, this.password);
};

module.exports = mongoose.model("User", user_schema);