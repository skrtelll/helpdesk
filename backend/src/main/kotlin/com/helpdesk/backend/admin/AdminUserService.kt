package com.helpdesk.backend.admin

import com.helpdesk.backend.common.ConflictException
import com.helpdesk.backend.common.NotFoundException
import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.common.SortWhitelist
import com.helpdesk.backend.security.RefreshTokenRepository
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import com.helpdesk.backend.user.UserResponse
import com.helpdesk.backend.user.toResponse
import jakarta.persistence.criteria.Predicate
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.domain.Specification
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

private val USER_SORT_FIELDS = setOf("email", "displayName", "role", "enabled", "createdAt", "updatedAt")

@Service
class AdminUserService(
    private val users: UserRepository,
    private val refreshTokens: RefreshTokenRepository,
) {

    @Transactional(readOnly = true)
    fun list(role: Role?, enabled: Boolean?, search: String?, pageable: Pageable): PageResponse<UserResponse> {
        SortWhitelist.validate(pageable, USER_SORT_FIELDS)
        val spec = Specification<User> { root, _, cb ->
            val predicates = mutableListOf<Predicate>()
            role?.let { predicates += cb.equal(root.get<Role>("role"), it) }
            enabled?.let { predicates += cb.equal(root.get<Boolean>("enabled"), it) }
            search?.trim()?.takeIf { it.isNotEmpty() }?.let {
                val pattern = "%${it.lowercase()}%"
                predicates += cb.or(
                    cb.like(cb.lower(root.get<String>("email")), pattern),
                    cb.like(cb.lower(root.get<String>("displayName")), pattern),
                )
            }
            cb.and(*predicates.toTypedArray())
        }
        return PageResponse.of(users.findAll(spec, pageable).map { it.toResponse() })
    }

    @Transactional
    fun changeRole(userId: UUID, role: Role): UserResponse {
        val target = loadUser(userId)
        if (target.role == role) return target.toResponse()
        if (target.role == Role.ADMIN && role != Role.ADMIN && target.enabled) ensureNotLastAdmin(target)
        target.role = role
        return target.toResponse()
    }

    @Transactional
    fun changeEnabled(userId: UUID, enabled: Boolean): UserResponse {
        val target = loadUser(userId)
        if (target.enabled == enabled) return target.toResponse()
        if (!enabled && target.role == Role.ADMIN) ensureNotLastAdmin(target)
        target.enabled = enabled
        if (!enabled) {
            // Отключённый пользователь не должен продлевать сессию через refresh
            refreshTokens.findByUserIdAndRevokedAtIsNull(target.id!!).forEach { it.revoke() }
        }
        return target.toResponse()
    }

    private fun ensureNotLastAdmin(target: User) {
        val activeAdmins = users.lockActiveByRole(Role.ADMIN)
        val targetIsActiveAdmin = activeAdmins.any { it.id == target.id }
        if (targetIsActiveAdmin && activeAdmins.size <= 1) {
            throw ConflictException("LAST_ADMIN", "Нельзя понизить или отключить последнего активного ADMIN")
        }
    }

    private fun loadUser(id: UUID): User =
        users.findById(id).orElseThrow { NotFoundException("Пользователь не найден") }
}