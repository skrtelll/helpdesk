package com.helpdesk.backend.ticket

import com.helpdesk.backend.category.Category
import com.helpdesk.backend.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import jakarta.persistence.Version
import org.hibernate.annotations.Generated
import org.hibernate.generator.EventType
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "tickets")
class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    /** Человекочитаемый номер (HD-1001). Генерируется БД (DEFAULT из последовательности). */
    @Generated(event = [EventType.INSERT])
    @Column(nullable = false, length = 30, insertable = false, updatable = false)
    var number: String? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    lateinit var author: User

    /** Только SUPPORT/ADMIN — проверяется триггером trg_tickets_assignee_role. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    var assignee: User? = null

    /** Категория заявки. По умолчанию OTHER, меняется сотрудником поддержки. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    lateinit var category: Category

    @Column(nullable = false, length = 200)
    lateinit var title: String

    @Column(nullable = false, columnDefinition = "text")
    lateinit var description: String

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    var status: TicketStatus = TicketStatus.NEW

    /** Приоритет. По умолчанию MEDIUM, меняется сотрудником поддержки. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var priority: Priority = Priority.MEDIUM

    // ---- Временные метки жизненного цикла ----

    @Column(name = "resolved_at")
    var resolvedAt: Instant? = null

    @Column(name = "closed_at")
    var closedAt: Instant? = null

    @Column(name = "cancelled_at")
    var cancelledAt: Instant? = null

    @Generated(event = [EventType.INSERT])
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null

    @Generated(event = [EventType.INSERT, EventType.UPDATE])
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    var updatedAt: Instant? = null

    /** Optimistic locking (BR-015). При конфликте Hibernate бросает OptimisticLockException -> 409. */
    @Version
    @Column(nullable = false)
    var version: Long = 0
}
