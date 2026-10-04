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
import java.math.BigDecimal
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "tickets")
class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    /** Человекочитаемый номер (TCK-001000). Генерируется триггером БД. */
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

    /** Текущая ИТОГОВАЯ категория (после ML и/или правки сотрудником). */
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

    /** Текущий ИТОГОВЫЙ приоритет. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var priority: Priority = Priority.MEDIUM

    // ---- ML-прогноз: хранится отдельно от итоговых category/priority (BR-006) ----

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "ml_category_id")
    var mlCategory: Category? = null

    @Column(name = "ml_category_confidence", precision = 5, scale = 4)
    var mlCategoryConfidence: BigDecimal? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "ml_priority", length = 20)
    var mlPriority: Priority? = null

    @Column(name = "ml_priority_confidence", precision = 5, scale = 4)
    var mlPriorityConfidence: BigDecimal? = null

    @Column(name = "ml_model_version", length = 100)
    var mlModelVersion: String? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "ml_prediction_status", nullable = false, length = 20)
    var mlPredictionStatus: MlPredictionStatus = MlPredictionStatus.PENDING

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
