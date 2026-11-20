package com.helpdesk.backend.security

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import java.util.UUID

interface RefreshTokenRepository : JpaRepository<RefreshToken, UUID> {

    /** Блокировка до конца транзакции: второй параллельный refresh с тем же токеном ждёт и видит revoked_at. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    fun findByTokenHash(tokenHash: String): RefreshToken?

    fun findByUserIdAndRevokedAtIsNull(userId: UUID): List<RefreshToken>
}