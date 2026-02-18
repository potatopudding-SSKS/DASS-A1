const mongoose = require('mongoose');

const discussion_schema = new mongoose.Schema({
    event: {type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true},
    participant: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    message_type: {type: String, enum: ['Question', 'Announcement', 'Reply'], default: 'Question'},
    content: {type: String, required: true},
    parent_message: {type: mongoose.Schema.Types.ObjectId, ref: 'Discussion'},
    is_pinned: {type: Boolean, default: false},
    is_deleted: {type: Boolean, default: false},
    reactions: [{user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emoji: String}],
}, {timestamps: true});

module.exports = mongoose.model('Discussion', discussion_schema);