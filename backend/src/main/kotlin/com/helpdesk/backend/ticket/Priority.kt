package com.helpdesk.backend.ticket

/** Приоритеты. Совпадают с CHECK по priority в V1__init_schema.sql. */
enum class Priority {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL,
}
