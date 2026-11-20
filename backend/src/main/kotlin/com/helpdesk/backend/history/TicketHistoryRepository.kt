package com.helpdesk.backend.history

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TicketHistoryRepository : JpaRepository<TicketHistory, UUID> {

    /** История отдаётся массивом по возрастанию времени (раздел 7.3). */
    fun findByTicketIdOrderByCreatedAtAsc(ticketId: UUID): List<TicketHistory>
}