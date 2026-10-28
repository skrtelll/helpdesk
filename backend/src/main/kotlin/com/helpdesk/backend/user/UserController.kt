package com.helpdesk.backend.user

import com.helpdesk.backend.security.CurrentUserProvider
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/users")
class UserController(
    private val users: UserService,
    private val current: CurrentUserProvider,
) {
    @GetMapping("/me")
    fun me(): UserResponse = current.require().toResponse()

    @PatchMapping("/me")
    fun updateMe(@Valid @RequestBody req: UpdateProfileRequest): UserResponse =
        users.updateDisplayName(current.require(), req.displayName)
}
