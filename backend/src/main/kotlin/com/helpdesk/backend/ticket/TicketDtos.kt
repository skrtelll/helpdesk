package com.helpdesk.backend.ticket

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

/** Клиент передаёт только title и description (REST-контракт, п.6). */
data class CreateTicketRequest(
    @field:NotBlank @field:Size(max = 200) val title: String,
    @field:NotBlank val description: String,
)

data class TicketResponse(
    val id: UUID,
    val number: String,
    val title: String,
    val description: String,
    val status: TicketStatus,
    val priority: Priority,
    val category: String,
    val authorId: UUID,
    val assigneeId: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val version: Long,
)

fun Ticket.toResponse() = TicketResponse(
    id = id!!,
    number = number!!,
    title = title,
    description = description,
    status = status,
    priority = priority,
    category = category.code,
    authorId = author.id!!,
    assigneeId = assignee?.id,
    createdAt = createdAt!!,
    updatedAt = updatedAt!!,
    version = version,
)
