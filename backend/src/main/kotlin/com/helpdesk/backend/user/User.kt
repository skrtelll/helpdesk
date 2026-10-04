package com.helpdesk.backend.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import org.hibernate.generator.EventType
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "users")
class User {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    /** Уникальность без учёта регистра обеспечивает индекс uq_users_email_lower. */
    @Column(nullable = false, length = 254)
    lateinit var email: String

    @Column(name = "password_hash", nullable = false)
    lateinit var passwordHash: String

    @Column(name = "display_name", nullable = false, length = 100)
    lateinit var displayName: String

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var role: Role = Role.USER

    @Column(nullable = false)
    var enabled: Boolean = true

    /** Заполняется БД (DEFAULT now()). */
    @Generated(event = [EventType.INSERT])
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null

    /** Обновляется триггером set_updated_at — для инкрементальной загрузки в аналитику. */
    @Generated(event = [EventType.INSERT, EventType.UPDATE])
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    var updatedAt: Instant? = null
}
