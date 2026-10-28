package com.helpdesk.backend.security

import com.helpdesk.backend.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import org.hibernate.generator.EventType
import java.time.Instant
import java.util.UUID

/**
 * Refresh token. В БД хранится только SHA-256 хеш (hex, 64 символа), сам токен не сохраняется
 * (см. V3__refresh_tokens.sql). Ротация: при обмене старый токен отзывается ([revoke]).
 */
@Entity
@Table(name = "refresh_tokens")
class RefreshToken {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false)
    lateinit var user: User

    @Column(name = "token_hash", nullable = false, length = 64, updatable = false)
    lateinit var tokenHash: String

    @Column(name = "expires_at", nullable = false, updatable = false)
    lateinit var expiresAt: Instant

    @Column(name = "revoked_at")
    var revokedAt: Instant? = null

    @Generated(event = [EventType.INSERT])
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null

    fun isActive(now: Instant = Instant.now()): Boolean = revokedAt == null && expiresAt.isAfter(now)

    fun revoke(now: Instant = Instant.now()) {
        if (revokedAt == null) revokedAt = now
    }
}
