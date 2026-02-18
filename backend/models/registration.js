const mongoose = require('mongoose');

const registration_schema = new mongoose.Schema({
    event: {type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true},
    participant: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    status: {type: String, enum: ['Registered', 'Cancelled', 'Attended', 'Rejected'], default: 'Registered'},
    payment_status: {type: String, enum: ['NotRequired', 'Pending', 'Approved', 'Rejected'], default: 'NotRequired'},
    payment_amount: Number,
    form_responses: [{field_label: String, field_value: mongoose.Schema.Types.Mixed}],
    merchandise_details: {size: String, color: String, variant: String, quantity: {type: Number, default: 1}},
    team: {type: mongoose.Schema.Types.ObjectId, ref: 'Team'},
    team_name: String,
    ticket_id: {type: String, unique: true, sparse: true},
    qr_code: String,
    attended_at: Date,
}, {timestamps: true});

registration_schema.pre('save', async function() {
    if (this.isNew && !this.ticket_id) {
        this.ticket_id = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
});

module.exports = mongoose.model('Registration', registration_schema);