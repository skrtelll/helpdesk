package com.helpdesk.backend.history

/** Типы событий аудита. Совпадают с CHECK ck_ticket_history_event_type. */
enum class TicketEventType {
    TICKET_CREATED,
    ML_PREDICTION_APPLIED,
    ML_PREDICTION_FAILED,
    STATUS_CHANGED,
    PRIORITY_CHANGED,
    CATEGORY_CHANGED,
    ASSIGNEE_CHANGED,
    COMMENT_ADDED,
    TICKET_RESOLVED,
    TICKET_REOPENED,
    TICKET_CLOSED,
    TICKET_CANCELLED,
}
