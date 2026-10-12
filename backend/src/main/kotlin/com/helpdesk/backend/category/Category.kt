package com.helpdesk.backend.category

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.Generated
import org.hibernate.generator.EventType
import java.time.Instant
import java.util.UUID


@Entity
@Table(name = "categories")
class Category {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    /** Машинный код; неизменяем после создания (REST-контракт, п.11). */
    @Column(nullable = false, length = 50, updatable = false)
    lateinit var code: String

    @Column(nullable = false, length = 100)
    lateinit var name: String

    @Column(columnDefinition = "text")
    var description: String? = null

    @Column(nullable = false)
    var active: Boolean = true

    @Generated(event = [EventType.INSERT])
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null

    @Generated(event = [EventType.INSERT, EventType.UPDATE])
    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    var updatedAt: Instant? = null
}
