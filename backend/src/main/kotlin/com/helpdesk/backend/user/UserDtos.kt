package com.helpdesk.backend.user

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class UpdateProfileRequest(
    @field:NotBlank @field:Size(max = 100) val displayName: String,
)

data class UserResponse(
    val id: UUID,
    val email: String,
    val displayName: String,
    val role: Role,
    val enabled: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)

fun User.toResponse() = UserResponse(
    id = id!!, email = email, displayName = displayName, role = role, enabled = enabled,
    createdAt = createdAt!!, updatedAt = updatedAt!!,
)
