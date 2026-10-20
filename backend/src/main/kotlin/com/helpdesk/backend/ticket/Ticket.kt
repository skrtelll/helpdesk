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
import org.hibernate.annotations.UpdateTimestamp
import org.hibernate.generator.EventType
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "tickets")
class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    /** Человекочитаемый номер (HD-1000, HD-1001, ...). Генерируется БД (DEFAULT из sequence). */
    @Generated(event = [EventType.INSERT])
    @Column(nullable = false, length = 30, insertable = false, updatable = false)
    var number: String? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    lateinit var author: User

    /** Менять только через [assignTo]: правило «исполнитель — SUPPORT/ADMIN» живёт в сервисном слое, не в БД. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    var assignee: User? = null
        protected set

    /** Категория заявки. При создании OTHER, меняется сотрудником поддержки. */
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

    /** Приоритет. При создании MEDIUM, меняется сотрудником поддержки. */
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

    /** Обновляется приложением при каждом изменении (триггеров в БД нет) — нужно для инкрементальной выгрузки в аналитику. */
    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null

    /** Optimistic locking. При конфликте Hibernate бросает OptimisticLockException -> 409 VERSION_CONFLICT. */
    @Version
    @Column(nullable = false)
    var version: Long = 0

    /** Назначить исполнителя. Допустимы только SUPPORT и ADMIN; null снимает назначение. */
    fun assignTo(user: User?) {
        require(user == null || user.role.isStaff()) {
            "Исполнителем заявки может быть только SUPPORT или ADMIN"
        }
        assignee = user
    }
}
