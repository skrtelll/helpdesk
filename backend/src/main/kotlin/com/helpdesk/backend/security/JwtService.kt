package com.helpdesk.backend.security

import com.helpdesk.backend.user.User
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import java.time.Instant
import java.util.Date
import java.util.UUID
import javax.crypto.SecretKey

@Service
class JwtService(
    @Value("\${app.jwt.secret}") secret: String,
    @Value("\${app.jwt.access-token-ttl-seconds:3600}") private val ttlSeconds: Long,
) {
    private val key: SecretKey = Keys.hmacShaKeyFor(secret.toByteArray())

    /** Payload: sub = users.id, role — только справочно. Роль при каждом запросе перечитывается из БД (SEC-005). */
    fun issueAccessToken(user: User, now: Instant = Instant.now()): String =
        Jwts.builder()
            .subject(user.id.toString())
            .claim("role", user.role.name)
            .issuedAt(Date.from(now))
            .expiration(Date.from(now.plusSeconds(ttlSeconds)))
            .signWith(key)
            .compact()

    /** id пользователя, если подпись верна и срок не истёк; иначе null. */
    fun parseUserId(token: String): UUID? = runCatching {
        val claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).payload
        UUID.fromString(claims.subject)
    }.getOrNull()

    fun accessTokenTtlSeconds(): Long = ttlSeconds
}