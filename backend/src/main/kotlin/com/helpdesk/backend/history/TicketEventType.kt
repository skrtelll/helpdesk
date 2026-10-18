package com.helpdesk.backend.history

/** Типы событий аудита. Совпадают с CHECK ck_ticket_history_event_type (см. V5). */
enum class TicketEventType {
    TICKET_CREATED,
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
