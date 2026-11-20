package com.helpdesk.backend.user

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface UserRepository : JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

    fun findByEmailIgnoreCase(email: String): User?

    fun existsByEmailIgnoreCase(email: String): Boolean

    fun countByRoleAndEnabledTrue(role: Role): Long

    /**
     * Блокирует строки активных пользователей с ролью: две параллельные операции понижения
     * не смогут одновременно «увидеть» двух админов и обе пройти (BR-014).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.role = :role and u.enabled = true")
    fun lockActiveByRole(@Param("role") role: Role): List<User>
}