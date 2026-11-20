package com.helpdesk.backend.comment

import com.helpdesk.backend.common.ConflictException
import com.helpdesk.backend.common.ForbiddenException
import com.helpdesk.backend.common.NotFoundException
import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.history.TicketEventType
import com.helpdesk.backend.history.TicketHistoryRecorder
import com.helpdesk.backend.ticket.Ticket
import com.helpdesk.backend.ticket.TicketRepository
import com.helpdesk.backend.ticket.TicketService
import com.helpdesk.backend.ticket.canSee
import com.helpdesk.backend.user.User
import org.springframework.data.domain.PageRequest
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class CommentService(
    private val tickets: TicketRepository,
    private val ticketService: TicketService,
    private val comments: CommentRepository,
    private val audit: TicketHistoryRecorder,
) {

    @Transactional(readOnly = true)
    fun list(current: User, ticketId: UUID, pageable: Pageable): PageResponse<CommentResponse> {
        visibleTicket(current, ticketId)
        val sorted = PageRequest.of(pageable.pageNumber, pageable.pageSize, Sort.by("createdAt").ascending())
        val page = if (current.role.isStaff()) {
            comments.findByTicketId(ticketId, sorted)
        } else {
            comments.findByTicketIdAndInternalFalse(ticketId, sorted)
        }
        return PageResponse.of(page.map { it.toResponse() })
    }

    @Transactional
    fun add(current: User, ticketId: UUID, req: CommentRequest): CommentResponse {
        val ticket = visibleTicket(current, ticketId)
        if (req.`internal` && !current.role.isStaff()) {
            throw ForbiddenException("INTERNAL_COMMENT_FORBIDDEN", "Внутренние комментарии доступны только сотрудникам")
        }
        if (ticket.status.isTerminal()) {
            throw ConflictException("TICKET_TERMINAL", "Заявка в терминальном статусе: комментарии запрещены")
        }

        val saved = comments.saveAndFlush(Comment().apply {
            this.ticket = ticket
            this.author = current
            this.text = req.text
            this.`internal` = req.`internal`
        })
        // newValue = id комментария: по нему USER-история скрывает внутренние комментарии
        audit.record(ticket, current, TicketEventType.COMMENT_ADDED, newValue = saved.id.toString())

        val isPublicFromUser = !req.`internal` && !current.role.isStaff()
        if (isPublicFromUser) ticketService.resumeAfterUserReply(current, ticket)

        return saved.toResponse()
    }

    private fun visibleTicket(user: User, ticketId: UUID): Ticket {
        val ticket = tickets.findById(ticketId).orElseThrow { NotFoundException("Заявка не найдена") }
        if (!canSee(user, ticket)) throw NotFoundException("Заявка не найдена")
        return ticket
    }
}