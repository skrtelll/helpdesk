package com.helpdesk.backend

import com.helpdesk.backend.category.CategoryRepository
import com.helpdesk.backend.security.RefreshToken
import com.helpdesk.backend.security.RefreshTokenRepository
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
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import java.time.Instant
import java.time.temporal.ChronoUnit

/**
 * Проверяет на реальном PostgreSQL: Flyway применяет V1–V3, Hibernate (ddl-auto=validate)
 * принимает сущности, ограничения схемы работают, а правила, вынесенные из БД в код
 * (роль исполнителя, updated_at), выполняются приложением.
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
    lateinit var refreshTokens: RefreshTokenRepository

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
        assertThat(loaded.number).matches("HD-\\d+")
        assertThat(loaded.status).isEqualTo(TicketStatus.NEW)
        assertThat(loaded.createdAt).isNotNull()
        assertThat(loaded.version).isZero()
    }

    @Test
    fun emailIsUniqueIgnoringCase() {
        newUser("Same@Example.com", Role.USER)
        assertThatThrownBy { newUser("same@example.com", Role.USER) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    fun resolvedStatusRequiresResolvedAt() {
        val author = newUser("a2@example.com", Role.USER)
        val ticket = newTicket(author).apply {
            status = TicketStatus.RESOLVED // resolved_at не заполнен
        }

        assertThatThrownBy { tickets.saveAndFlush(ticket) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
            .hasStackTraceContaining("violates check constraint")
    }

    // Правило «исполнитель — SUPPORT/ADMIN» проверяется в коде (в БД триггера нет).
    @Test
    fun assigneeMustBeSupportOrAdmin() {
        val author = newUser("author@example.com", Role.USER)
        val ticket = newTicket(author)

        assertThatThrownBy { ticket.assignTo(author) } // USER — недопустим
            .isInstanceOf(IllegalArgumentException::class.java)
        assertThat(ticket.assignee).isNull()
    }

    @Test
    fun supportUserCanBeAssignee() {
        val author = newUser("author2@example.com", Role.USER)
        val support = newUser("support@example.com", Role.SUPPORT)
        val ticket = newTicket(author).apply { assignTo(support) }

        val saved = tickets.saveAndFlush(ticket)

        assertThat(saved.id).isNotNull()
        assertThat(saved.assignee).isEqualTo(support)
    }

    // updated_at обновляет приложение (@UpdateTimestamp): на нём построена инкрементальная выгрузка.
    @Test
    fun updatingTicketBumpsVersionAndUpdatedAt() {
        val author = newUser("a3@example.com", Role.USER)
        val saved = tickets.saveAndFlush(newTicket(author))
        val before = saved.updatedAt!!
        Thread.sleep(5)

        saved.title = "Новый заголовок"
        tickets.saveAndFlush(saved)

        assertThat(saved.version).isEqualTo(1)
        assertThat(saved.updatedAt).isAfter(before)
    }

    @Test
    fun refreshTokenCanBeSavedAndFoundByHash() {
        val owner = newUser("rt@example.com", Role.USER)
        val hash = "a".repeat(64)
        val token = RefreshToken().apply {
            user = owner
            tokenHash = hash
            expiresAt = Instant.now().plus(7, ChronoUnit.DAYS)
        }
        refreshTokens.saveAndFlush(token)
        em.clear()

        val loaded = refreshTokens.findByTokenHash(hash)

        assertThat(loaded).isNotNull()
        assertThat(loaded!!.isActive()).isTrue()
        assertThat(loaded.createdAt).isNotNull()
    }

    @Test
    fun revokedRefreshTokenIsNotActive() {
        val owner = newUser("rt2@example.com", Role.USER)
        val token = RefreshToken().apply {
            user = owner
            tokenHash = "b".repeat(64)
            expiresAt = Instant.now().plus(7, ChronoUnit.DAYS)
        }
        refreshTokens.saveAndFlush(token)

        token.revoke()
        refreshTokens.saveAndFlush(token)

        assertThat(token.isActive()).isFalse()
        assertThat(refreshTokens.findByUserIdAndRevokedAtIsNull(owner.id!!)).isEmpty()
    }
}