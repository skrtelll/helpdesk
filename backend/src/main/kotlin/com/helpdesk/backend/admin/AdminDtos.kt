package com.helpdesk.backend.admin

import com.helpdesk.backend.user.Role
import jakarta.validation.constraints.AssertTrue
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import java.time.Instant
import java.util.UUID

// ---- пользователи ----

data class ChangeRoleRequest(@field:NotNull val role: Role?)

data class ChangeEnabledRequest(@field:NotNull val enabled: Boolean?)

// ---- категории ----

data class CreateCategoryRequest(
    @field:NotBlank @field:Size(max = 50) @field:Pattern(regexp = "^[A-Z][A-Z0-9_]*$") val code: String?,
    @field:NotBlank @field:Size(max = 100) val name: String?,
    val description: String?,
)

data class UpdateCategoryRequest(
    @field:Size(max = 100) val name: String?,
    val description: String?,
) {
    @AssertTrue(message = "Название не может быть пустым")
    fun isNameValid(): Boolean = name == null || name.isNotBlank()
}

data class SetCategoryActiveRequest(@field:NotNull val active: Boolean?)

data class AdminCategoryResponse(
    val id: UUID,
    val code: String,
    val name: String,
    val description: String?,
    val active: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)