const resolve_event_status = (event) => {
    if (!event) return "Draft";

    const current_status = event.status;
    if (current_status === "Draft" || current_status === "Closed") {
        return current_status;
    }

    const now = new Date();
    const start = event.event_start_date ? new Date(event.event_start_date) : null;
    const end = event.event_end_date ? new Date(event.event_end_date) : null;

    if (!start || !end) {
        return current_status;
    }

    if (now < start) {
        return "Published";
    }
    if (now >= start && now <= end) {
        return "Ongoing";
    }
    return "Completed";
};

const apply_resolved_event_status = (event) => {
    if (!event) return event;

    const resolved = resolve_event_status(event);
    if (typeof event.toObject === "function") {
        const object_event = event.toObject();
        object_event.status = resolved;
        return object_event;
    }

    return { ...event, status: resolved };
};

module.exports = {
    resolve_event_status,
    apply_resolved_event_status
};
