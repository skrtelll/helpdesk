package com.helpdesk.backend.comment

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CommentRepository : JpaRepository<Comment, UUID> {

    /** Для SUPPORT/ADMIN: публичные + внутренние. */
    fun findByTicketIdOrderByCreatedAtAsc(ticketId: UUID): List<Comment>

    /** Для USER: только публичные. Фильтрация на уровне запроса, а не в DTO. */
    fun findByTicketIdAndInternalFalseOrderByCreatedAtAsc(ticketId: UUID): List<Comment>
}
