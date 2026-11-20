package com.helpdesk.backend.ticket

import com.helpdesk.backend.user.User
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.JpaSpecificationExecutor
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.time.Instant
import java.util.UUID

interface TicketRepository : JpaRepository<Ticket, UUID>, JpaSpecificationExecutor<Ticket> {

    fun findByNumber(number: String): Ticket?

    /** Время БД: метки resolved_at / closed_at / cancelled_at не должны быть раньше created_at. */
    @Query(value = "SELECT now()", nativeQuery = true)
    fun dbNow(): java.sql.Timestamp

    /**
     * Атомарный take: назначает исполнителя, только если заявка свободна, в NEW и версия совпадает.
     * Возвращает число обновлённых строк: 0 означает конфликт.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(
        """
        update Ticket t
           set t.assignee = :assignee,
               t.status = :inProgress,
               t.version = t.version + 1,
               t.updatedAt = :now
         where t.id = :id
           and t.assignee is null
           and t.status = :expected
           and t.version = :version
        """
    )
    fun takeIfUnassigned(
        @Param("id") id: UUID,
        @Param("assignee") assignee: User,
        @Param("expected") expected: TicketStatus,
        @Param("inProgress") inProgress: TicketStatus,
        @Param("version") version: Long,
        @Param("now") now: Instant,
    ): Int
}