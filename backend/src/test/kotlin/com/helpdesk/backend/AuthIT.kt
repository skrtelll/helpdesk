package com.helpdesk.backend

import com.fasterxml.jackson.databind.JsonNode
import com.fasterxml.jackson.databind.ObjectMapper
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
class AuthIT {

    companion object {
        @Container
        @JvmField
        val POSTGRES = PostgreSQLContainer("postgres:16-alpine")

        @JvmStatic
        @DynamicPropertySource
        fun props(r: DynamicPropertyRegistry) {
            r.add("spring.datasource.url", POSTGRES::getJdbcUrl)
            r.add("spring.datasource.username", POSTGRES::getUsername)
            r.add("spring.datasource.password", POSTGRES::getPassword)
        }
    }

    @Autowired lateinit var mvc: MockMvc
    @Autowired lateinit var users: UserRepository
    @Autowired lateinit var json: ObjectMapper

    private val password = "StrongPassword123"

    private fun register(email: String): JsonNode =
        json.readTree(
            mvc.perform(
                post("/api/v1/auth/register")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"$email","password":"$password","displayName":"Test"}""")
            ).andExpect(status().isCreated()).andReturn().response.contentAsString
        )

    private fun login(email: String): JsonNode =
        json.readTree(
            mvc.perform(
                post("/api/v1/auth/login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"$email","password":"$password"}""")
            ).andExpect(status().isOk()).andReturn().response.contentAsString
        )

    private fun uniqueEmail() = "u-${UUID.randomUUID()}@test.local"

    @Test
    fun registerThenLoginReturnsTokens() {
        val email = uniqueEmail()
        register(email)
        val tokens = login(email)
        assert(tokens.get("accessToken").asText().isNotBlank())
        assert(tokens.get("expiresIn").asLong() == 3600L)
    }

    @Test
    fun refreshRotatesTokenAndRejectsOldOne() {
        val email = uniqueEmail()
        register(email)
        val first = login(email).get("refreshToken").asText()

        mvc.perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refreshToken":"$first"}""")
        ).andExpect(status().isOk())

        // Повторное использование отозванного токена
        mvc.perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refreshToken":"$first"}""")
        ).andExpect(status().isUnauthorized())
    }

    @Test
    fun logoutRevokesRefreshToken() {
        val email = uniqueEmail()
        register(email)
        val tokens = login(email)
        val access = tokens.get("accessToken").asText()
        val refresh = tokens.get("refreshToken").asText()

        mvc.perform(
            post("/api/v1/auth/logout")
                .header("Authorization", "Bearer $access")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refreshToken":"$refresh"}""")
        ).andExpect(status().isNoContent())

        mvc.perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"refreshToken":"$refresh"}""")
        ).andExpect(status().isUnauthorized())
    }

    @Test
    fun disabledUserCannotLogin() {
        val email = uniqueEmail()
        register(email)
        val user = users.findByEmailIgnoreCase(email)!!
        user.enabled = false
        users.saveAndFlush(user)

        mvc.perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"email":"$email","password":"$password"}""")
        ).andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("USER_DISABLED"))
    }

    @Test
    fun profileRejectsFieldsOtherThanDisplayName() {
        val email = uniqueEmail()
        register(email)
        val access = login(email).get("accessToken").asText()

        mvc.perform(
            patch("/api/v1/users/me")
                .header("Authorization", "Bearer $access")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"displayName":"New","role":"ADMIN"}""")
        ).andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
    }

    @Test
    fun userCannotUseAdminApi() {
        val email = uniqueEmail()
        register(email)
        val access = login(email).get("accessToken").asText()

        mvc.perform(get("/api/v1/admin/users").header("Authorization", "Bearer $access"))
            .andExpect(status().isForbidden())
    }

    @Test
    fun lastActiveAdminCannotBeDemoted() {
        // Отключаем остальных админов, оставшихся от других тестов класса
        users.findAll().filter { it.role == Role.ADMIN }.forEach {
            it.enabled = false
            users.saveAndFlush(it)
        }

        val email = uniqueEmail()
        val id = register(email).get("id").asText()
        val admin = users.findByEmailIgnoreCase(email)!!.apply { role = Role.ADMIN }
        users.saveAndFlush(admin)
        val access = login(email).get("accessToken").asText()

        mvc.perform(
            patch("/api/v1/admin/users/$id/role")
                .header("Authorization", "Bearer $access")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"role":"USER"}""")
        ).andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("LAST_ADMIN"))
    }
}