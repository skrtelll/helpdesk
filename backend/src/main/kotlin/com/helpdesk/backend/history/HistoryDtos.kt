package com.helpdesk.backend.history

import com.helpdesk.backend.common.UserRef
import java.time.Instant

data class HistoryResponse(
    val eventType: TicketEventType,
    val fieldName: String?,
    val oldValue: String?,
    val newValue: String?,
    val changedBy: UserRef?,
    val createdAt: Instant,
)

fun TicketHistory.toResponse() = HistoryResponse(
    eventType = eventType,
    fieldName = fieldName,
    oldValue = oldValue,
    newValue = newValue,
    changedBy = changedBy?.let { UserRef(it.id!!, it.displayName) },
    createdAt = createdAt!!,
)