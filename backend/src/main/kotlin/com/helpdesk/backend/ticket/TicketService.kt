package com.helpdesk.backend.ticket

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
@Transactional(readOnly = true)
class TicketService(
    private val ticketRepository: TicketRepository,
) {
    fun getAll(): List<Ticket> = ticketRepository.findAll()
}