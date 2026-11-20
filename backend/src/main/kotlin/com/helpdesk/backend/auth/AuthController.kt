package com.helpdesk.backend.auth

import com.helpdesk.backend.security.CurrentUserProvider
import com.helpdesk.backend.user.UserResponse
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val auth: AuthService,
    private val current: CurrentUserProvider,
) {

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    fun register(@Valid @RequestBody req: RegisterRequest): UserResponse = auth.register(req)

    @PostMapping("/login")
    fun login(@Valid @RequestBody req: LoginRequest): TokenResponse = auth.login(req)

    @PostMapping("/refresh")
    fun refresh(@Valid @RequestBody req: RefreshRequest): TokenResponse = auth.refresh(req)

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun logout(@Valid @RequestBody req: LogoutRequest) {
        auth.logout(current.require(), req)
    }
}