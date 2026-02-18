const mongoose = require('mongoose');

const password_reset_schema = new mongoose.Schema({
    organiser: {type: mongoose.Schema.Types.ObjectId, ref: 'Organiser', required: true},
    reason: {type: String, required: true},
    club_name: String,
    status: {type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending'},
    reviewed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    reviewed_at: Date,
    admin_comments: String,
    new_password: String,
}, {timestamps: true});

module.exports = mongoose.model('PasswordReset', password_reset_schema);