package com.helpdesk.entity

import com.helpdesk.entity.enums.MlPredictionStatus
import com.helpdesk.entity.enums.Priority
import com.helpdesk.entity.enums.TicketStatus
import jakarta.persistence.*
import org.hibernate.annotations.CreationTimestamp
import org.hibernate.annotations.UpdateTimestamp
import java.math.BigDecimal
import java.time.LocalDateTime

@Entity
@Table(name = "tickets")
data class Ticket(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null,

    @Column(unique = true, nullable = false)
    var number: Long? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "author_id", nullable = false)
    var author: User,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    var assignee: User? = null,

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id", nullable = false)
    var category: Category,

    @Column(nullable = false, length = 200)
    var title: String,

    @Column(nullable = false, columnDefinition = "TEXT")
    var description: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    var status: TicketStatus = TicketStatus.NEW,  

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var priority: Priority = Priority.MEDIUM,

    @Column(name = "ml_category_code", length = 50)
    var mlCategoryCode: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "ml_priority", length = 20)
    var mlPriority: Priority? = null,

    @Column(name = "ml_confidence", precision = 5, scale = 4)
    var mlConfidence: BigDecimal? = null,

    @Column(name = "ml_model_version", length = 50)
    var mlModelVersion: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(name = "ml_prediction_status", nullable = false, length = 20)
    var mlPredictionStatus: MlPredictionStatus = MlPredictionStatus.PENDING,

    @Column(name = "resolved_at")
    var resolvedAt: LocalDateTime? = null,

    @Column(name = "closed_at")
    var closedAt: LocalDateTime? = null,

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    val createdAt: LocalDateTime? = null,

    @UpdateTimestamp
    @Column(name = "updated_at")
    var updatedAt: LocalDateTime? = null,

    @Version 
    var version: Long = 0
)