package com.helpdesk.backend.ticket

import com.helpdesk.backend.category.Category
import com.helpdesk.backend.category.CategoryRepository
import com.helpdesk.backend.common.NotFoundException
import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.common.SortWhitelist
import com.helpdesk.backend.user.User
import jakarta.persistence.criteria.Predicate
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

private val TICKET_SORT_FIELDS = setOf("createdAt", "updatedAt", "priority", "status", "number", "title")

@Service
@Transactional(readOnly = true)
class TicketService(
    private val tickets: TicketRepository,
    private val categories: CategoryRepository,
) {

    @Transactional
    fun create(author: User, req: CreateTicketRequest): TicketResponse {
        val other = categories.findByCode("OTHER")
            ?: throw IllegalStateException("Категория OTHER не найдена: проверьте V2__seed_data.sql")
        val ticket = Ticket().apply {
            this.author = author
            this.category = other
            this.title = req.title
            this.description = req.description
        }
        return tickets.saveAndFlush(ticket).toResponse()
    }

    fun get(current: User, id: UUID): TicketResponse {
        val ticket = tickets.findById(id).orElseThrow { NotFoundException("Заявка не найдена") }
        // Чужую заявку отдаём как 404, а не 403, чтобы не раскрывать факт её существования.
        if (!canSee(current, ticket)) throw NotFoundException("Заявка не найдена")
        return ticket.toResponse()
    }

    fun list(
        current: User,
        status: TicketStatus?,
        priority: Priority?,
        category: String?,
        pageable: Pageable,
    ): PageResponse<TicketResponse> {
        SortWhitelist.validate(pageable, TICKET_SORT_FIELDS)
        val spec = buildSpec(current, status, priority, category)
        return PageResponse.of(tickets.findAll(spec, pageable).map { it.toResponse() })
    }

    private fun buildSpec(
        current: User,
        status: TicketStatus?,
        priority: Priority?,
        category: String?,
    ): Specification<Ticket> = Specification { root, _, cb ->
        val predicates = mutableListOf<Predicate>()
        if (!current.role.isStaff()) {
            predicates += cb.equal(root.get<User>("author").get<UUID>("id"), current.id)
        }
        status?.let { predicates += cb.equal(root.get<TicketStatus>("status"), it) }
        priority?.let { predicates += cb.equal(root.get<Priority>("priority"), it) }
        category?.let { predicates += cb.equal(root.get<Category>("category").get<String>("code"), it) }
        cb.and(*predicates.toTypedArray())
    }
}
