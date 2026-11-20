package com.helpdesk.backend.admin

import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.UserResponse
import jakarta.validation.Valid
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/admin/users")
class AdminUserController(private val admin: AdminUserService) {

    @GetMapping
    fun list(
        @RequestParam(required = false) role: Role?,
        @RequestParam(required = false) enabled: Boolean?,
        @RequestParam(required = false) search: String?,
        @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC) pageable: Pageable,
    ): PageResponse<UserResponse> = admin.list(role, enabled, search, pageable)

    @PatchMapping("/{userId}/role")
    fun changeRole(@PathVariable userId: UUID, @Valid @RequestBody req: ChangeRoleRequest): UserResponse =
        admin.changeRole(userId, req.role!!)

    @PatchMapping("/{userId}/enabled")
    fun changeEnabled(@PathVariable userId: UUID, @Valid @RequestBody req: ChangeEnabledRequest): UserResponse =
        admin.changeEnabled(userId, req.enabled!!)
}