package com.helpdesk.backend.support

import com.helpdesk.backend.category.Category
import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.common.SortWhitelist
import com.helpdesk.backend.ticket.Priority
import com.helpdesk.backend.ticket.Ticket
import com.helpdesk.backend.ticket.TicketRepository
import com.helpdesk.backend.ticket.TicketStatus
import com.helpdesk.backend.ticket.TicketSummary
import com.helpdesk.backend.ticket.toSummary
import com.helpdesk.backend.user.User
import jakarta.persistence.criteria.Predicate
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

private val QUEUE_STATUSES = listOf(
    TicketStatus.NEW,
    TicketStatus.IN_PROGRESS,
    TicketStatus.WAITING_FOR_USER,
    TicketStatus.RESOLVED,
)
private val QUEUE_SORT_FIELDS = setOf("createdAt", "updatedAt", "priority", "status", "number", "title")

@Service
@Transactional(readOnly = true)
class SupportQueueService(private val tickets: TicketRepository) {

    /**
     * Очередь: все открытые заявки. По умолчанию — CRITICAL сверху, затем старые выше.
     * Если клиент передал свою сортировку, она имеет приоритет над умолчанием.
     */
    fun queue(category: String?, priority: Priority?, unassignedOnly: Boolean, pageable: Pageable): PageResponse<TicketSummary> {
        SortWhitelist.validate(pageable, QUEUE_SORT_FIELDS)
        val spec = Specification<Ticket> { root, query, cb ->
            val predicates = mutableListOf<Predicate>(root.get<TicketStatus>("status").`in`(QUEUE_STATUSES))
            category?.let { predicates += cb.equal(root.get<Category>("category").get<String>("code"), it) }
            priority?.let { predicates += cb.equal(root.get<Priority>("priority"), it) }
            if (unassignedOnly) predicates += cb.isNull(root.get<User>("assignee"))

            // Сортировку по умолчанию задаём только для выборки строк, не для COUNT
            if (query != null && query.resultType != Long::class.java && pageable.sort.isUnsorted) {
                val priorityRank = cb.selectCase<Int>()
                    .`when`(cb.equal(root.get<Priority>("priority"), Priority.CRITICAL), 4)
                    .`when`(cb.equal(root.get<Priority>("priority"), Priority.HIGH), 3)
                    .`when`(cb.equal(root.get<Priority>("priority"), Priority.MEDIUM), 2)
                    .otherwise(1)
                query.orderBy(cb.desc(priorityRank), cb.asc(root.get<Instant>("createdAt")))
            }
            cb.and(*predicates.toTypedArray())
        }
        return PageResponse.of(tickets.findAll(spec, pageable).map { it.toSummary() })
    }

    /** Заявки, назначенные текущему сотруднику. Без status — все открытые (не CLOSED и не CANCELLED). */
    fun myTickets(current: User, status: TicketStatus?, pageable: Pageable): PageResponse<TicketSummary> {
        SortWhitelist.validate(pageable, QUEUE_SORT_FIELDS)
        val spec = Specification<Ticket> { root, _, cb ->
            val predicates = mutableListOf<Predicate>(
                cb.equal(root.get<User>("assignee").get<java.util.UUID>("id"), current.id),
            )
            if (status != null) {
                predicates += cb.equal(root.get<TicketStatus>("status"), status)
            } else {
                predicates += root.get<TicketStatus>("status").`in`(QUEUE_STATUSES)
            }
            cb.and(*predicates.toTypedArray())
        }
        return PageResponse.of(tickets.findAll(spec, pageable).map { it.toSummary() })
    }
}