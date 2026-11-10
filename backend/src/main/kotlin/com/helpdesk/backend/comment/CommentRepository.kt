package com.helpdesk.backend.comment

import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CommentRepository : JpaRepository<Comment, UUID> {

    /** Для SUPPORT/ADMIN: публичные и внутренние. */
    fun findByTicketId(ticketId: UUID, pageable: Pageable): Page<Comment>

    /** Для USER: только публичные. */
    fun findByTicketIdAndInternalFalse(ticketId: UUID, pageable: Pageable): Page<Comment>

    /** Внутренние комментарии заявки: нужны, чтобы скрыть их события в истории для USER. */
    fun findByTicketIdAndInternalTrue(ticketId: UUID): List<Comment>
}