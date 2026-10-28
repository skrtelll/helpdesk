package com.helpdesk.backend.comment

import com.helpdesk.backend.common.ConflictException
import com.helpdesk.backend.common.ForbiddenException
import com.helpdesk.backend.common.NotFoundException
import com.helpdesk.backend.ticket.Ticket
import com.helpdesk.backend.ticket.TicketRepository
import com.helpdesk.backend.ticket.TicketStatus
import com.helpdesk.backend.ticket.canSee
import com.helpdesk.backend.user.User
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class CommentService(
    private val tickets: TicketRepository,
    private val comments: CommentRepository,
) {

    @Transactional(readOnly = true)
    fun list(current: User, ticketId: UUID): List<CommentResponse> {
        visibleTicket(current, ticketId)
        val found = if (current.role.isStaff()) {
            comments.findByTicketIdOrderByCreatedAtAsc(ticketId)
        } else {
            comments.findByTicketIdAndInternalFalseOrderByCreatedAtAsc(ticketId)
        }
        return found.map { it.toResponse() }
    }

    @Transactional
    fun add(current: User, ticketId: UUID, req: CommentRequest): CommentResponse {
        val ticket = visibleTicket(current, ticketId)
        if (req.`internal` && !current.role.isStaff()) {
            throw ForbiddenException("INTERNAL_COMMENT_FORBIDDEN", "Внутренние комментарии доступны только сотрудникам")
        }
        if (ticket.status == TicketStatus.CLOSED || ticket.status == TicketStatus.CANCELLED) {
            throw ConflictException("TICKET_TERMINAL", "Заявка в терминальном статусе: комментарии запрещены")
        }
        val comment = Comment().apply {
            this.ticket = ticket
            this.author = current
            this.text = req.text
            this.`internal` = req.`internal`
        }
        return comments.saveAndFlush(comment).toResponse()
    }

    private fun visibleTicket(user: User, ticketId: UUID): Ticket {
        val ticket = tickets.findById(ticketId).orElseThrow { NotFoundException("Заявка не найдена") }
        if (!canSee(user, ticket)) throw NotFoundException("Заявка не найдена")
        return ticket
    }
}
