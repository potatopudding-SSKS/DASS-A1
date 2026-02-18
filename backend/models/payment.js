const mongoose = require('mongoose');

const payment_schema = new mongoose.Schema({
    registration: {type: mongoose.Schema.Types.ObjectId, ref: 'Registration', required: true},
    participant: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    event: {type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true},
    amount: {type: Number, required: true},
    payment_proof: {type: String, required: true},
    status: {type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending'},
    reviewed_by: {type: mongoose.Schema.Types.ObjectId, ref: 'Organiser'},
    reviewed_at: Date,
    review_notes: String,
}, {timestamps: true});

module.exports = mongoose.model('Payment', payment_schema);