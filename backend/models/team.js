const mongoose = require('mongoose');

const team_schema = new mongoose.Schema({
    event: {type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true},
    team_name: {type: String, required: true},
    team_leader: {type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true},
    team_size: {type: Number, required: true},
    invite_code: {type: String, unique: true },
    members: [{
        user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        status: {type: String, enum: ['Invited', 'Accepted', 'Declined'], default: 'Invited'},
        joined_at: Date
    }],
    status: {type: String, enum: ['Forming', 'Complete', 'Cancelled'], default: 'Forming'},
    completed_at: Date,
}, {timestamps: true});

team_schema.pre('save', async function() {
    if (this.isNew && !this.invite_code) {
        this.invite_code = `TEAM-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
    }
});

module.exports = mongoose.model('Team', team_schema);