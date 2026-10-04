package com.helpdesk.backend.history

import com.helpdesk.backend.ticket.Ticket
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
import org.hibernate.annotations.Generated
import org.hibernate.generator.EventType
import java.time.Instant
import java.util.UUID

/** Неизменяемая запись бизнес-аудита (BR-012): только INSERT, без UPDATE/DELETE. */
@Entity
@Table(name = "ticket_history")
class TicketHistory {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false, updatable = false)
    lateinit var ticket: Ticket

    /** NULL для системных событий (например, ML fallback). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by", updatable = false)
    var changedBy: User? = null

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 50, updatable = false)
    lateinit var eventType: TicketEventType

    @Column(name = "field_name", length = 50, updatable = false)
    var fieldName: String? = null

    @Column(name = "old_value", columnDefinition = "text", updatable = false)
    var oldValue: String? = null

    @Column(name = "new_value", columnDefinition = "text", updatable = false)
    var newValue: String? = null

    @Generated(event = [EventType.INSERT])
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null
}
