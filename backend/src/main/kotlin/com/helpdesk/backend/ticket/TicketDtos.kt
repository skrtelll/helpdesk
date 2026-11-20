package com.helpdesk.backend.ticket

import com.helpdesk.backend.common.CategoryRef
import com.helpdesk.backend.common.UserRef
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

// ---- запросы ----

data class CreateTicketRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:NotBlank val description: String,
)

data class VersionRequest(@field:NotNull val version: Long?)

data class AssignRequest(
    @field:NotNull val assigneeId: UUID?,
    @field:NotNull val version: Long?,
)

data class ChangeStatusRequest(
    @field:NotNull val status: TicketStatus?,
    @field:NotNull val version: Long?,
)

data class ChangePriorityRequest(
    @field:NotNull val priority: Priority?,
    @field:NotNull val version: Long?,
)

data class ChangeCategoryRequest(
    @field:NotBlank val categoryCode: String?,
    @field:NotNull val version: Long?,
)

// ---- ответы ----

data class TicketResponse(
    val id: UUID,
    val number: String,
    val title: String,
    val description: String,
    val status: TicketStatus,
    val priority: Priority,
    val category: CategoryRef,
    val author: UserRef,
    val assignee: UserRef?,
    val version: Long,
    val createdAt: Instant,
    val updatedAt: Instant,
    val resolvedAt: Instant?,
    val closedAt: Instant?,
    val cancelledAt: Instant?,
)

data class TicketSummary(
    val id: UUID,
    val number: String,
    val title: String,
    val status: TicketStatus,
    val priority: Priority,
    val category: CategoryRef,
    val assignee: UserRef?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

fun Ticket.toResponse() = TicketResponse(
    id = id!!,
    number = number!!,
    title = title,
    description = description,
    status = status,
    priority = priority,
    category = CategoryRef(category.code, category.name),
    author = UserRef(author.id!!, author.displayName),
    assignee = assignee?.let { UserRef(it.id!!, it.displayName) },
    version = version,
    createdAt = createdAt!!,
    updatedAt = updatedAt!!,
    resolvedAt = resolvedAt,
    closedAt = closedAt,
    cancelledAt = cancelledAt,
)

fun Ticket.toSummary() = TicketSummary(
    id = id!!,
    number = number!!,
    title = title,
    status = status,
    priority = priority,
    category = CategoryRef(category.code, category.name),
    assignee = assignee?.let { UserRef(it.id!!, it.displayName) },
    createdAt = createdAt!!,
    updatedAt = updatedAt!!,
)