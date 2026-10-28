package com.helpdesk.backend

import com.fasterxml.jackson.databind.ObjectMapper
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import org.hamcrest.Matchers.startsWith
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
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
class ApiIT {

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
            r.add("app.auth.dev-header") { "true" }
        }
    }

    @Autowired lateinit var mvc: MockMvc
    @Autowired lateinit var users: UserRepository
    @Autowired lateinit var json: ObjectMapper

    private fun newUser(role: Role = Role.USER): User =
        users.saveAndFlush(User().apply {
            email = "u-${UUID.randomUUID()}@test.local"
            passwordHash = "hash"
            displayName = "Test"
            this.role = role
        })

    private fun createTicket(author: User): String {
        val body = mvc.perform(
            post("/api/v1/tickets")
                .header("X-User-Id", author.id.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"VPN","description":"не работает"}""")
        ).andExpect(status().isCreated()).andReturn().response.contentAsString
        return json.readTree(body).get("id").asText()
    }

    @Test
    fun createTicketGetsDefaults() {
        val u = newUser()
        mvc.perform(
            post("/api/v1/tickets")
                .header("X-User-Id", u.id.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"VPN","description":"не работает"}""")
        )
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.number", startsWith("HD-")))
            .andExpect(jsonPath("$.status").value("NEW"))
            .andExpect(jsonPath("$.priority").value("MEDIUM"))
            .andExpect(jsonPath("$.category").value("OTHER"))
    }

    @Test
    fun clientCannotSetStatusOnCreate() {
        val u = newUser()
        mvc.perform(
            post("/api/v1/tickets")
                .header("X-User-Id", u.id.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"x","description":"y","status":"CLOSED"}""")
        )
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("MALFORMED_REQUEST"))
    }

    @Test
    fun blankTitleGives422WithFieldErrors() {
        val u = newUser()
        mvc.perform(
            post("/api/v1/tickets")
                .header("X-User-Id", u.id.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"title":"","description":"y"}""")
        )
            .andExpect(status().`is`(422))
            .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.fieldErrors[0].field").value("title"))
    }

    @Test
    fun pageSizeIsCappedAt100() {
        val u = newUser()
        mvc.perform(get("/api/v1/tickets?size=101").header("X-User-Id", u.id.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.size").value(100))
    }

    @Test
    fun unknownSortFieldIsRejected() {
        val u = newUser()
        mvc.perform(get("/api/v1/tickets?sort=password").header("X-User-Id", u.id.toString()))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("INVALID_SORT"))
    }

    @Test
    fun userCannotSeeForeignTicket() {
        val owner = newUser()
        val stranger = newUser()
        val id = createTicket(owner)
        mvc.perform(get("/api/v1/tickets/$id").header("X-User-Id", stranger.id.toString()))
            .andExpect(status().isNotFound())
    }

    @Test
    fun userCannotPostInternalComment() {
        val u = newUser()
        val id = createTicket(u)
        mvc.perform(
            post("/api/v1/tickets/$id/comments")
                .header("X-User-Id", u.id.toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"text":"секрет","internal":true}""")
        )
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("INTERNAL_COMMENT_FORBIDDEN"))
    }

    @Test
    fun categoriesReturnSixActive() {
        mvc.perform(get("/api/v1/categories"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(6))
    }

    @Test
    fun meReturnsCurrentUser() {
        val u = newUser()
        mvc.perform(get("/api/v1/users/me").header("X-User-Id", u.id.toString()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value(u.email))
    }

    @Test
    fun requestWithoutAuthIsRejected() {
        mvc.perform(get("/api/v1/tickets"))
            .andExpect(status().isUnauthorized())
    }
}
