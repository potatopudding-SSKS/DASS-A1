const mongoose = require('mongoose');

const feedback_schema = new mongoose.Schema({
    event: {type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true},
    rating: {type: Number, required: true, min: 1, max: 5},
    comments: {type: String, required: true},
    submitted_at: {type: Date, default: Date.now}
}, {timestamps: true});

module.exports = mongoose.model('Feedback', feedback_schema);