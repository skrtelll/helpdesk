package com.helpdesk.backend.ticket

/** Статусы заявки. Совпадают с CHECK ck_tickets_status. */
enum class TicketStatus {
    NEW,
    IN_PROGRESS,
    WAITING_FOR_USER,
    RESOLVED,
    CLOSED,
    CANCELLED;

    /** CLOSED и CANCELLED терминальны в MVP (BR-011). */
    fun isTerminal(): Boolean = this == CLOSED || this == CANCELLED
}
