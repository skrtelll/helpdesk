package com.helpdesk.backend

import com.helpdesk.backend.category.CategoryRepository
import com.helpdesk.backend.ticket.Ticket
import com.helpdesk.backend.ticket.TicketRepository
import com.helpdesk.backend.ticket.TicketStatus
import com.helpdesk.backend.user.Role
import com.helpdesk.backend.user.User
import com.helpdesk.backend.user.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers

/**
 * Проверяет на реальном PostgreSQL: Flyway применяет миграции, Hibernate (ddl-auto=validate)
 * принимает сущности, а триггеры и CHECK из V1 работают.
 */
@DataJpaTest
@Testcontainers
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SchemaAndEntitiesIT {

    companion object {
        @Container
        @JvmField
        val POSTGRES = PostgreSQLContainer("postgres:16-alpine")

        @JvmStatic
        @DynamicPropertySource
        fun datasource(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", POSTGRES::getJdbcUrl)
            registry.add("spring.datasource.username", POSTGRES::getUsername)
            registry.add("spring.datasource.password", POSTGRES::getPassword)
        }
    }

    @Autowired
    lateinit var users: UserRepository

    @Autowired
    lateinit var categories: CategoryRepository

    @Autowired
    lateinit var tickets: TicketRepository

    @Autowired
    lateinit var em: EntityManager

    private fun newUser(email: String, role: Role): User {
        val user = User().apply {
            this.email = email
            passwordHash = "hash"
            displayName = "Test $role"
            this.role = role
        }
        return users.saveAndFlush(user)
    }

    private fun newTicket(author: User): Ticket {
        val other = categories.findByCode("OTHER") ?: error("seed category OTHER is missing")
        return Ticket().apply {
            this.author = author
            category = other
            title = "VPN не работает"
            description = "Не могу подключиться к VPN из дома"
        }
    }

    @Test
    fun seedCategoriesAreLoaded() {
        assertThat(categories.findAll()).extracting<String> { it.code }
            .containsExactlyInAnyOrder("ACCOUNT", "NETWORK", "ACCESS", "SOFTWARE", "HARDWARE", "OTHER")
    }

    @Test
    fun ticketGetsNumberAndDefaultsFromDatabase() {
        val author = newUser("user@example.com", Role.USER)
        val saved = tickets.saveAndFlush(newTicket(author))
        em.clear()

        val loaded = tickets.findById(saved.id!!).orElseThrow()
        assertThat(loaded.number).startsWith("TCK-")
        assertThat(loaded.status).isEqualTo(TicketStatus.NEW)
        assertThat(loaded.createdAt).isNotNull()
        assertThat(loaded.version).isZero()
    }

    @Test
    fun emailIsUniqueIgnoringCase() {
        newUser("Same@Example.com", Role.USER)
        assertThatThrownBy { newUser("same@example.com", Role.USER) }
            .isInstanceOf(Exception::class.java)
    }

    @Test
    fun assigneeMustBeSupportOrAdmin() {
        val author = newUser("author@example.com", Role.USER)
        val ticket = newTicket(author).apply {
            assignee = author // USER — недопустим
        }

        assertThatThrownBy { tickets.saveAndFlush(ticket) }
            .hasStackTraceContaining("must reference a user with role SUPPORT or ADMIN")
    }

    @Test
    fun resolvedStatusRequiresResolvedAt() {
        val author = newUser("a2@example.com", Role.USER)
        val ticket = newTicket(author).apply {
            status = TicketStatus.RESOLVED // resolved_at не заполнен
        }

        assertThatThrownBy { tickets.saveAndFlush(ticket) }
            .hasStackTraceContaining("ck_tickets_resolved_requires_resolved_at")
    }

    @Test
    fun updatingTicketBumpsVersionAndUpdatedAt() {
        val author = newUser("a3@example.com", Role.USER)
        val saved = tickets.saveAndFlush(newTicket(author))
        val before = saved.updatedAt

        saved.title = "Новый заголовок"
        tickets.saveAndFlush(saved)

        assertThat(saved.version).isEqualTo(1)
        assertThat(saved.updatedAt).isAfterOrEqualTo(before)
    }
}
