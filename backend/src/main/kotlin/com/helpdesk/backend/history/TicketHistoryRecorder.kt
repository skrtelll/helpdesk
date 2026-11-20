package com.helpdesk.backend.history

import com.helpdesk.backend.ticket.Ticket
import com.helpdesk.backend.user.User
import org.springframework.stereotype.Component

@Component
class TicketHistoryRecorder(private val repo: TicketHistoryRepository) {

    fun record(
        ticket: Ticket,
        actor: User?,
        type: TicketEventType,
        fieldName: String? = null,
        oldValue: String? = null,
        newValue: String? = null,
    ) {
        repo.save(TicketHistory().apply {
            this.ticket = ticket
            this.changedBy = actor
            this.eventType = type
            this.fieldName = fieldName
            this.oldValue = oldValue
            this.newValue = newValue
        })
    }
}