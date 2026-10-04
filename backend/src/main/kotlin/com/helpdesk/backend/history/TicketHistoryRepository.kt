package com.helpdesk.backend.history

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface TicketHistoryRepository : JpaRepository<TicketHistory, UUID> {

    /** История пагинируется (REST-контракт, п.10). */
    fun findByTicketId(ticketId: UUID, pageable: Pageable): Page<TicketHistory>
}
