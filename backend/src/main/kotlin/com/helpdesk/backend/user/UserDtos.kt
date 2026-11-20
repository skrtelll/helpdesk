package com.helpdesk.backend.user

import com.fasterxml.jackson.annotation.JsonAnySetter
import com.fasterxml.jackson.annotation.JsonIgnore
import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

data class UpdateProfileRequest(
    @field:NotBlank @field:Size(max = 100) val displayName: String?,
) {
    @JsonIgnore
    private val unknownFields = mutableMapOf<String, Any?>()

    @JsonAnySetter
    fun captureUnknown(name: String, value: Any?) {
        unknownFields[name] = value
    }

    @JsonIgnore
    @AssertTrue(message = "Допустимо только поле displayName")
    fun isOnlyDisplayName(): Boolean = unknownFields.isEmpty()
}

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
    id = id!!,
    email = email,
    displayName = displayName,
    role = role,
    enabled = enabled,
    createdAt = createdAt!!,
    updatedAt = updatedAt!!,
)