package com.helpdesk.backend.security

import com.fasterxml.jackson.databind.ObjectMapper
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtFilter: JwtAuthenticationFilter,
    private val mapper: ObjectMapper,
) {

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain = http
        .csrf { it.disable() }
        .httpBasic { it.disable() }
        .formLogin { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .authorizeHttpRequests { auth ->
            auth.requestMatchers("/health", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
            auth.requestMatchers(
                "/api/v1/auth/register",
                "/api/v1/auth/login",
                "/api/v1/auth/refresh",
            ).permitAll()
            auth.requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
            auth.requestMatchers("/api/v1/support/**").hasAnyRole("SUPPORT", "ADMIN")
            auth.anyRequest().authenticated()
        }
        .exceptionHandling {
            it.authenticationEntryPoint(entryPoint())
            it.accessDeniedHandler(deniedHandler())
        }
        .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter::class.java)
        .build()

    private fun entryPoint(): AuthenticationEntryPoint = AuthenticationEntryPoint { req, res, _ ->
        writeSecurityError(mapper, req, res, 401, "UNAUTHORIZED", "Требуется аутентификация")
    }

    private fun deniedHandler(): AccessDeniedHandler = AccessDeniedHandler { req, res, _ ->
        writeSecurityError(mapper, req, res, 403, "FORBIDDEN", "Доступ запрещён")
    }
}