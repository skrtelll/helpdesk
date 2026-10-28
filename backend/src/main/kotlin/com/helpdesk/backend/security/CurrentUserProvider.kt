package com.helpdesk.backend.security

import com.helpdesk.backend.common.BadRequestException
import com.helpdesk.backend.common.UnauthorizedException
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.UUID

interface CurrentUserProvider {
    fun require(): User
}

/**
 * ВРЕМЕННАЯ реализация до спринта 4 (JWT).
 * Пользователь берётся из заголовка X-User-Id, но только при app.auth.dev-header=true.
 * Иначе эндпоинты отвечают 401: без флага сервис не принимает анонимные запросы.
 */
@Component
class DevHeaderCurrentUserProvider(
    private val users: UserRepository,
    private val request: HttpServletRequest,
    @Value("\${app.auth.dev-header:false}") private val devHeader: Boolean,
) : CurrentUserProvider {

    override fun require(): User {
        if (!devHeader) throw UnauthorizedException("Аутентификация ещё не реализована")
        val raw = request.getHeader("X-User-Id")
            ?: throw UnauthorizedException("Требуется заголовок X-User-Id")
        val id = runCatching { UUID.fromString(raw) }
            .getOrElse { throw BadRequestException("INVALID_USER_ID", "Некорректный X-User-Id") }
        return users.findById(id).orElseThrow { UnauthorizedException("Пользователь не найден") }
    }
}
