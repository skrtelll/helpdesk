package com.helpdesk.backend.user

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserRepository : JpaRepository<User, UUID> {

    fun findByEmailIgnoreCase(email: String): User?

    fun existsByEmailIgnoreCase(email: String): Boolean

    /** Для правила BR-018: нельзя оставить систему без последнего активного ADMIN. */
    fun countByRoleAndEnabledTrue(role: Role): Long
}
