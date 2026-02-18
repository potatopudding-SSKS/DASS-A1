const mongoose = require("mongoose")

const event_schema = new mongoose.Schema({
    event_name: {type: String, required: true},
    event_description: {type: String, required: true},
    event_type: {type: String, enum: ["Normal", "Merchandise"], required: true},
    organiser: {type: mongoose.Schema.Types.ObjectId, ref: "Organiser", required: true},
    event_start_date: {type: Date, required: true},
    event_end_date: {type: Date, required: true},
    registration_deadline: {type: Date, required: true},
    registration_limit: {type: Number, default: null},
    registration_fee: {type: Number, default: 0},
    eligibility: {type: String, enum: ["IIIT-Only", "Non-IIIT-Only", "Both"], default: "Both"},
    event_tags: [String],
    status: {type: String, enum: ["Draft", "Published", "Ongoing", "Completed", "Closed"], default: "Draft"},
    custom_form_fields: [{
        field_label: String,
        field_type: {type: String, enum: ["text", "email", "number", "textarea", "dropdown", "checkbox", "file"]},
        field_options: [String],
        is_required: { type: Boolean, default: false },
        field_order: Number
    }],
    merch_details: {
        item_name: String,
        sizes: [String],
        colours: [String],
        variants: [String],
        stock_quantity: Number,
        purchase_limit_per_participant: Number
    },
    total_registration: {type: Number, default: 0},
    total_revenue: {type: Number, default: 0},
}, {timestamps: true});

event_schema.index({event_name: "text", event_description: "text", event_tags: "text"});

module.exports = mongoose.model("Event", event_schema);