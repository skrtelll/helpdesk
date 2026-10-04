package com.helpdesk.backend.comment

import com.helpdesk.backend.ticket.Ticket
import com.helpdesk.backend.user.User
import jakarta.persistence.Column
import jakarta.persistence.Entity
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

@Entity
@Table(name = "comments")
class Comment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    var id: UUID? = null

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "ticket_id", nullable = false, updatable = false)
    lateinit var ticket: Ticket

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "author_id", nullable = false, updatable = false)
    lateinit var author: User

    @Column(nullable = false, columnDefinition = "text")
    lateinit var text: String

    /** true — внутренний комментарий сотрудников; USER его не видит (BR-010). */
    @Column(nullable = false)
    var `internal`: Boolean = false

    @Generated(event = [EventType.INSERT])
    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null
}
