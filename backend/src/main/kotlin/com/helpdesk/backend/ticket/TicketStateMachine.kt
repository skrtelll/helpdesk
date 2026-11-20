package com.helpdesk.backend.ticket

import com.helpdesk.backend.common.ConflictException

enum class TicketAction {
    TAKE,           // NEW -> IN_PROGRESS, SUPPORT/ADMIN
    ASSIGN,         // NEW -> IN_PROGRESS, ADMIN (назначение)
    CANCEL,         // NEW -> CANCELLED (без исполнителя)
    REQUEST_INFO,   // IN_PROGRESS -> WAITING_FOR_USER
    RESUME,         // WAITING_FOR_USER -> IN_PROGRESS (PATCH или публичный комментарий USER)
    RESOLVE,        // IN_PROGRESS -> RESOLVED
    REOPEN,         // RESOLVED -> IN_PROGRESS
    CLOSE,          // RESOLVED -> CLOSED
}

object TicketStateMachine {

    private val transitions: Map<Pair<TicketStatus, TicketAction>, TicketStatus> = mapOf(
        (TicketStatus.NEW to TicketAction.TAKE) to TicketStatus.IN_PROGRESS,
        (TicketStatus.NEW to TicketAction.ASSIGN) to TicketStatus.IN_PROGRESS,
        (TicketStatus.NEW to TicketAction.CANCEL) to TicketStatus.CANCELLED,
        (TicketStatus.IN_PROGRESS to TicketAction.REQUEST_INFO) to TicketStatus.WAITING_FOR_USER,
        (TicketStatus.WAITING_FOR_USER to TicketAction.RESUME) to TicketStatus.IN_PROGRESS,
        (TicketStatus.IN_PROGRESS to TicketAction.RESOLVE) to TicketStatus.RESOLVED,
        (TicketStatus.RESOLVED to TicketAction.REOPEN) to TicketStatus.IN_PROGRESS,
        (TicketStatus.RESOLVED to TicketAction.CLOSE) to TicketStatus.CLOSED,
    )

    fun next(from: TicketStatus, action: TicketAction): TicketStatus =
        transitions[from to action]
            ?: throw ConflictException(
                "INVALID_STATUS_TRANSITION",
                "Действие $action из статуса $from недопустимо",
            )

    /** Действие, которое соответствует PATCH /status (from -> to). null — такой переход через PATCH запрещён. */
    fun actionFor(from: TicketStatus, to: TicketStatus): TicketAction? = when {
        from == TicketStatus.IN_PROGRESS && to == TicketStatus.WAITING_FOR_USER -> TicketAction.REQUEST_INFO
        from == TicketStatus.WAITING_FOR_USER && to == TicketStatus.IN_PROGRESS -> TicketAction.RESUME
        from == TicketStatus.IN_PROGRESS && to == TicketStatus.RESOLVED -> TicketAction.RESOLVE
        from == TicketStatus.RESOLVED && to == TicketStatus.IN_PROGRESS -> TicketAction.REOPEN
        else -> null
    }
}