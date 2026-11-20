package com.helpdesk.backend.security

import com.helpdesk.backend.common.UnauthorizedException
import com.helpdesk.backend.user.User
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component

interface CurrentUserProvider {
    fun require(): User
}

/** Текущий пользователь, положенный в SecurityContext фильтром JWT. Заголовок X-User-Id больше не принимается. */
@Component
class SecurityCurrentUserProvider : CurrentUserProvider {
    override fun require(): User {
        val principal = SecurityContextHolder.getContext().authentication?.principal
        return principal as? User ?: throw UnauthorizedException("Требуется аутентификация")
    }
}