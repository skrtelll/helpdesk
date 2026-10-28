package com.helpdesk.backend.comment

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class CommentRequest(
    @field:NotBlank @field:Size(max = 5000) val text: String,
    val `internal`: Boolean = false,
)

data class CommentResponse(
    val id: UUID,
    val ticketId: UUID,
    val authorId: UUID,
    val text: String,
    val `internal`: Boolean,
    val createdAt: Instant,
)

fun Comment.toResponse() = CommentResponse(
    id = id!!,
    ticketId = ticket.id!!,
    authorId = author.id!!,
    text = text,
    `internal` = this.`internal`,
    createdAt = createdAt!!,
)
