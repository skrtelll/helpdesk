package com.helpdesk.backend.ticket

/** Приоритеты. Совпадают с CHECK ck_tickets_priority / ck_tickets_ml_priority. */
enum class Priority {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL,
}
