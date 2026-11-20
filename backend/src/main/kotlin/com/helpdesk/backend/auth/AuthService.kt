package com.helpdesk.backend.auth

import com.helpdesk.backend.common.ConflictException
import com.helpdesk.backend.common.ForbiddenException
import com.helpdesk.backend.common.UnauthorizedException
import com.helpdesk.backend.security.JwtService
import com.helpdesk.backend.security.RefreshToken
import com.helpdesk.backend.security.RefreshTokenRepository
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import com.helpdesk.backend.user.UserResponse
import com.helpdesk.backend.user.toResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.MessageDigest
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Base64

@Service
class AuthService(
    private val users: UserRepository,
    private val refreshTokens: RefreshTokenRepository,
    private val jwt: JwtService,
    private val passwords: PasswordEncoder,
    @Value("\${app.jwt.refresh-token-ttl-days:14}") private val refreshTtlDays: Long,
) {
    private val random = SecureRandom()

    @Transactional
    fun register(req: RegisterRequest): UserResponse {
        val email = req.email!!.trim()
        if (users.existsByEmailIgnoreCase(email)) throw emailTaken()
        val user = User().apply {
            this.email = email
            passwordHash = passwords.encode(req.password!!)
            displayName = req.displayName!!.trim()
            role = Role.USER
            enabled = true
        }
        return try {
            users.saveAndFlush(user).toResponse()
        } catch (e: DataIntegrityViolationException) {
            // Гонка двух регистраций с одним email: уникальный индекс срабатывает раньше проверки
            throw emailTaken()
        }
    }

    @Transactional
    fun login(req: LoginRequest): TokenResponse {
        val user = users.findByEmailIgnoreCase(req.email!!.trim())
            ?.takeIf { passwords.matches(req.password!!, it.passwordHash) }
            ?: throw UnauthorizedException("Неверный email или пароль")
        // Проверка enabled идёт после пароля: снаружи не видно, существует ли отключённый аккаунт
        if (!user.enabled) throw ForbiddenException("USER_DISABLED", "Пользователь отключён")
        return issueTokens(user)
    }

    @Transactional
    fun refresh(req: RefreshRequest): TokenResponse {
        val stored = refreshTokens.findByTokenHash(sha256(req.refreshToken!!))
            ?: throw UnauthorizedException("Refresh token недействителен")
        if (!stored.isActive()) throw UnauthorizedException("Refresh token недействителен")
        val user = stored.user
        if (!user.enabled) throw ForbiddenException("USER_DISABLED", "Пользователь отключён")
        stored.revoke() // ротация: старый токен больше не работает
        return issueTokens(user)
    }

    @Transactional
    fun logout(current: User, req: LogoutRequest) {
        refreshTokens.findByTokenHash(sha256(req.refreshToken!!))
            ?.takeIf { it.user.id == current.id }
            ?.revoke()
    }

    private fun issueTokens(user: User): TokenResponse {
        val raw = newRefreshToken()
        refreshTokens.save(RefreshToken().apply {
            this.user = user
            tokenHash = sha256(raw)
            expiresAt = Instant.now().plus(refreshTtlDays, ChronoUnit.DAYS)
        })
        return TokenResponse(
            accessToken = jwt.issueAccessToken(user),
            refreshToken = raw,
            expiresIn = jwt.accessTokenTtlSeconds(),
        )
    }

    private fun newRefreshToken(): String {
        val bytes = ByteArray(32)
        random.nextBytes(bytes)
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
    }

    private fun emailTaken() = ConflictException("EMAIL_ALREADY_EXISTS", "Пользователь с таким email уже существует")

    companion object {
        /** В БД хранится только хеш: утечка таблицы не даёт рабочих токенов. */
        fun sha256(value: String): String =
            MessageDigest.getInstance("SHA-256")
                .digest(value.toByteArray())
                .joinToString("") { "%02x".format(it) }
    }
}