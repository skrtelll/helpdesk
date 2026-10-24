package com.helpdesk.backend.security

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {

    fun findByTokenHash(tokenHash: String): RefreshToken?

    /** Все действующие (не отозванные) токены пользователя — например, для logout со всех устройств. */
    fun findByUserIdAndRevokedAtIsNull(userId: UUID): List<RefreshToken>
}
