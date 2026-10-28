package com.helpdesk.backend.ticket

import com.helpdesk.backend.user.User

/** USER видит только свои заявки; SUPPORT/ADMIN видят все (BR-001, FR-TICKET-003). */
fun canSee(user: User, ticket: Ticket): Boolean =
    user.role.isStaff() || ticket.author.id == user.id
