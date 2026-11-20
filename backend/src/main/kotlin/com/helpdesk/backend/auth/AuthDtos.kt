package com.helpdesk.backend.auth

import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class RegisterRequest(
    @field:NotBlank @field:Email @field:Size(max = 254) val email: String?,
    @field:NotBlank @field:Size(min = 8, max = 72) val password: String?,
    @field:NotBlank @field:Size(max = 100) val displayName: String?,
)

data class LoginRequest(
    @field:NotBlank @field:Email val email: String?,
    @field:NotBlank val password: String?,
)

data class RefreshRequest(@field:NotBlank val refreshToken: String?)

data class LogoutRequest(@field:NotBlank val refreshToken: String?)

data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val tokenType: String = "Bearer",
    val expiresIn: Long,
)