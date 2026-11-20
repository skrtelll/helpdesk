package com.helpdesk.backend.ticket

import com.helpdesk.backend.category.Category
import com.helpdesk.backend.category.CategoryRepository
import com.helpdesk.backend.comment.CommentRepository
import com.helpdesk.backend.common.ConflictException
import com.helpdesk.backend.common.ForbiddenException
import com.helpdesk.backend.common.NotFoundException
import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.common.SortWhitelist
import com.helpdesk.backend.common.UnprocessableException
import com.helpdesk.backend.history.HistoryResponse
import com.helpdesk.backend.history.TicketEventType
import com.helpdesk.backend.history.TicketHistoryRecorder
import com.helpdesk.backend.history.TicketHistoryRepository
import com.helpdesk.backend.history.toResponse
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import jakarta.persistence.criteria.Predicate
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

private val TICKET_SORT_FIELDS = setOf("createdAt", "updatedAt", "priority", "status", "number", "title")

@Service
@Transactional(readOnly = true)
class TicketService(
    private val tickets: TicketRepository,
    private val categories: CategoryRepository,
    private val users: UserRepository,
    private val comments: CommentRepository,
    private val historyRepo: TicketHistoryRepository,
    private val audit: TicketHistoryRecorder,
) {

    // ---- создание и чтение ----

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
        tickets.saveAndFlush(ticket)
        audit.record(ticket, author, TicketEventType.TICKET_CREATED)
        return ticket.toResponse()
    }

    fun get(current: User, id: UUID): TicketResponse = loadVisible(current, id).toResponse()

    fun list(
        current: User,
        status: TicketStatus?,
        priority: Priority?,
        category: String?,
        pageable: Pageable,
    ): PageResponse<TicketSummary> {
        SortWhitelist.validate(pageable, TICKET_SORT_FIELDS)
        val spec = buildSpec(current, status, priority, category)
        return PageResponse.of(tickets.findAll(spec, pageable).map { it.toSummary() })
    }

    fun history(current: User, id: UUID): List<HistoryResponse> {
        val ticket = loadVisible(current, id)
        val ticketId = ticket.id!!
        // USER не видит COMMENT_ADDED по внутренним комментариям (раздел 7.3)
        val hiddenCommentIds: Set<String> =
            if (current.role.isStaff()) emptySet()
            else comments.findByTicketIdAndInternalTrue(ticketId).mapNotNull { it.id?.toString() }.toSet()
        return historyRepo.findByTicketIdOrderByCreatedAtAsc(ticketId)
            .filterNot { event ->
                event.eventType == TicketEventType.COMMENT_ADDED &&
                        event.newValue?.let { it in hiddenCommentIds } == true
            }
            .map { it.toResponse() }
    }

    // ---- take / assign / переходы ----

    @Transactional
    fun take(current: User, id: UUID, version: Long): TicketResponse {
        requireStaff(current)
        val updated = tickets.takeIfUnassigned(
            id = id,
            assignee = current,
            expected = TicketStatus.NEW,
            inProgress = TicketStatus.IN_PROGRESS,
            version = version,
            now = dbNow(),
        )
        val ticket = loadOrNotFound(id) // после UPDATE контекст очищен, объект свежий
        if (updated == 0) {
            when {
                ticket.version != version ->
                    throw ConflictException("VERSION_CONFLICT", "Заявка изменена, обновите данные")
                ticket.assignee != null ->
                    throw ConflictException("ALREADY_ASSIGNED", "Заявка уже взята другим сотрудником")
                else ->
                    throw ConflictException("INVALID_STATUS_TRANSITION", "Заявку нельзя взять в статусе ${ticket.status}")
            }
        }
        audit.record(ticket, current, TicketEventType.ASSIGNEE_CHANGED, "assignee", null, current.id.toString())
        audit.record(ticket, current, TicketEventType.STATUS_CHANGED, "status", "NEW", "IN_PROGRESS")
        return ticket.toResponse()
    }

    @Transactional
    fun assign(current: User, id: UUID, req: AssignRequest): TicketResponse {
        requireAdmin(current)
        val ticket = loadOrNotFound(id)
        ensureNotTerminal(ticket)
        checkVersion(ticket, req.version!!)

        val assignee = users.findById(req.assigneeId!!)
            .orElseThrow { NotFoundException("Исполнитель не найден") }
        if (!assignee.role.isStaff() || !assignee.enabled) {
            throw UnprocessableException("INVALID_ASSIGNEE", "Исполнитель должен быть SUPPORT или ADMIN и быть активным")
        }

        val oldAssigneeId = ticket.assignee?.id?.toString()
        val fromStatus = ticket.status
        ticket.assignTo(assignee)
        if (fromStatus == TicketStatus.NEW) ticket.transition(TicketAction.ASSIGN, dbNow())
        tickets.saveAndFlush(ticket)

        audit.record(ticket, current, TicketEventType.ASSIGNEE_CHANGED, "assignee", oldAssigneeId, assignee.id.toString())
        if (ticket.status != fromStatus) {
            audit.record(ticket, current, TicketEventType.STATUS_CHANGED, "status", fromStatus.name, ticket.status.name)
        }
        return ticket.toResponse()
    }

    @Transactional
    fun changeStatus(current: User, id: UUID, req: ChangeStatusRequest): TicketResponse {
        requireStaff(current)
        val ticket = loadOrNotFound(id)
        val target = req.status!!
        // SUPPORT не закрывает и не отменяет заявки (раздел 3.4)
        if (current.role == Role.SUPPORT && target.isTerminal()) {
            throw ForbiddenException("FORBIDDEN", "Закрывать и отменять заявки может автор или ADMIN")
        }
        ensureNotTerminal(ticket)
        checkVersion(ticket, req.version!!)
        val action = TicketStateMachine.actionFor(ticket.status, target)
            ?: throw ConflictException("INVALID_STATUS_TRANSITION", "Переход ${ticket.status} → $target недопустим")
        return applyTransition(current, ticket, action)
    }

    @Transactional
    fun cancel(current: User, id: UUID, version: Long): TicketResponse {
        val ticket = loadVisible(current, id)
        requireAuthorOrAdmin(current, ticket)
        ensureNotTerminal(ticket)
        checkVersion(ticket, version)
        // Условие «только NEW без исполнителя» обеспечивает TicketStateMachine
        return applyTransition(current, ticket, TicketAction.CANCEL)
    }

    @Transactional
    fun close(current: User, id: UUID, version: Long): TicketResponse {
        val ticket = loadVisible(current, id)
        requireAuthorOrAdmin(current, ticket)
        ensureNotTerminal(ticket)
        checkVersion(ticket, version)
        return applyTransition(current, ticket, TicketAction.CLOSE)
    }

    /** Вызывается из CommentService: публичный комментарий USER в WAITING_FOR_USER → IN_PROGRESS (BR-013). */
    @Transactional
    fun resumeAfterUserReply(author: User, ticket: Ticket) {
        if (ticket.status == TicketStatus.WAITING_FOR_USER) {
            applyTransition(author, ticket, TicketAction.RESUME)
        }
    }

    // ---- приоритет и категория ----

    @Transactional
    fun changePriority(current: User, id: UUID, req: ChangePriorityRequest): TicketResponse {
        requireStaff(current)
        val ticket = loadOrNotFound(id)
        ensureNotTerminal(ticket)
        checkVersion(ticket, req.version!!)

        val old = ticket.priority
        val new = req.priority!!
        if (old == new) return ticket.toResponse()
        ticket.priority = new
        tickets.saveAndFlush(ticket)
        audit.record(ticket, current, TicketEventType.PRIORITY_CHANGED, "priority", old.name, new.name)
        return ticket.toResponse()
    }

    @Transactional
    fun changeCategory(current: User, id: UUID, req: ChangeCategoryRequest): TicketResponse {
        requireStaff(current)
        val ticket = loadOrNotFound(id)
        ensureNotTerminal(ticket)
        checkVersion(ticket, req.version!!)

        val target = categories.findByCode(req.categoryCode!!)
            ?: throw NotFoundException("Категория не найдена")
        if (!target.active) throw UnprocessableException("CATEGORY_INACTIVE", "Категория неактивна")

        val old = ticket.category
        if (old.id == target.id) return ticket.toResponse()
        ticket.category = target
        tickets.saveAndFlush(ticket)
        audit.record(ticket, current, TicketEventType.CATEGORY_CHANGED, "category", old.code, target.code)
        return ticket.toResponse()
    }

    // ---- внутренние помощники ----

    /** Единая точка смены статуса: меняет заявку и пишет историю. */
    private fun applyTransition(actor: User, ticket: Ticket, action: TicketAction): TicketResponse {
        val from = ticket.status
        val to = ticket.transition(action, dbNow())
        tickets.saveAndFlush(ticket)
        audit.record(ticket, actor, TicketEventType.STATUS_CHANGED, "status", from.name, to.name)
        eventFor(action)?.let { audit.record(ticket, actor, it, "status", from.name, to.name) }
        return ticket.toResponse()
    }

    private fun eventFor(action: TicketAction): TicketEventType? = when (action) {
        TicketAction.RESOLVE -> TicketEventType.TICKET_RESOLVED
        TicketAction.REOPEN -> TicketEventType.TICKET_REOPENED
        TicketAction.CLOSE -> TicketEventType.TICKET_CLOSED
        TicketAction.CANCEL -> TicketEventType.TICKET_CANCELLED
        else -> null
    }

    private fun checkVersion(ticket: Ticket, expected: Long) {
        if (ticket.version != expected) {
            throw ConflictException("VERSION_CONFLICT", "Заявка изменена, обновите данные")
        }
    }

    private fun ensureNotTerminal(ticket: Ticket) {
        if (ticket.status.isTerminal()) {
            throw ConflictException("TICKET_TERMINAL", "Заявка в терминальном статусе")
        }
    }

    private fun dbNow(): Instant = tickets.dbNow().toInstant()

    private fun requireStaff(user: User) {
        if (!user.role.isStaff()) throw ForbiddenException("FORBIDDEN", "Доступно только сотрудникам поддержки")
    }

    private fun requireAdmin(user: User) {
        if (user.role != Role.ADMIN) throw ForbiddenException("FORBIDDEN", "Доступно только администратору")
    }

    private fun requireAuthorOrAdmin(user: User, ticket: Ticket) {
        val allowed = user.role == Role.ADMIN || (user.role == Role.USER && ticket.author.id == user.id)
        if (!allowed) throw ForbiddenException("FORBIDDEN", "Действие доступно автору заявки или администратору")
    }

    private fun loadOrNotFound(id: UUID): Ticket =
        tickets.findById(id).orElseThrow { NotFoundException("Заявка не найдена") }

    private fun loadVisible(user: User, id: UUID): Ticket {
        val ticket = loadOrNotFound(id)
        if (!canSee(user, ticket)) throw NotFoundException("Заявка не найдена")
        return ticket
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