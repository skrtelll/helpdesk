package com.helpdesk.backend.security

import com.fasterxml.jackson.databind.ObjectMapper
import com.helpdesk.backend.common.ApiError
import com.helpdesk.backend.user.UserRepository
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Instant

@Component
class JwtAuthenticationFilter(
    private val jwt: JwtService,
    private val users: UserRepository,
    private val mapper: ObjectMapper,
) : OncePerRequestFilter() {

    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        val header = req.getHeader(HttpHeaders.AUTHORIZATION)
        if (header != null && header.startsWith("Bearer ")) {
            val userId = jwt.parseUserId(header.removePrefix("Bearer ").trim())
            val user = userId?.let { users.findById(it).orElse(null) }
            if (user != null) {
                if (!user.enabled) {
                    // BR / раздел 6.3: отключённый пользователь не работает даже с действующим токеном
                    writeSecurityError(mapper, req, res, 403, "USER_DISABLED", "Пользователь отключён")
                    return
                }
                SecurityContextHolder.getContext().authentication = UsernamePasswordAuthenticationToken(
                    user, null, listOf(SimpleGrantedAuthority("ROLE_${user.role.name}")),
                )
            }
        }
        chain.doFilter(req, res)
    }
}

/** Единый JSON-формат ошибок и для фильтров (вне @RestControllerAdvice). */
internal fun writeSecurityError(
    mapper: ObjectMapper,
    req: HttpServletRequest,
    res: HttpServletResponse,
    status: Int,
    code: String,
    message: String,
) {
    res.status = status
    res.contentType = MediaType.APPLICATION_JSON_VALUE
    res.characterEncoding = "UTF-8"
    mapper.writeValue(res.writer, ApiError(Instant.now(), status, code, message, req.requestURI))
}