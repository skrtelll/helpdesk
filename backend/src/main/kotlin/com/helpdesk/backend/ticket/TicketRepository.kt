package com.helpdesk.backend.ticket

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import java.util.UUID

/**
 * JpaSpecificationExecutor понадобится для фильтрации списков
 * (status/priority/category/assigneeId/search) в спринте 2.
 */
interface TicketRepository : JpaRepository<Ticket, UUID>, JpaSpecificationExecutor<Ticket> {

    fun findByNumber(number: String): Ticket?
}
