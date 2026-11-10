package com.helpdesk.backend.comment

import com.helpdesk.backend.user.Role
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class CommentRequest(
    @field:NotBlank @field:Size(max = 5000) val text: String,
    val `internal`: Boolean = false,
)

data class AuthorRef(val id: UUID, val displayName: String, val role: Role)

data class CommentResponse(
    val id: UUID,
    val ticketId: UUID,
    val author: AuthorRef,
    val text: String,
    val `internal`: Boolean,
    val createdAt: Instant,
)

fun Comment.toResponse() = CommentResponse(
    id = id!!,
    ticketId = ticket.id!!,
    author = AuthorRef(author.id!!, author.displayName, author.role),
    text = text,
    `internal` = this.`internal`,
    createdAt = createdAt!!,
)