package com.helpdesk.backend.ticket

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/tickets")
class TicketController(
    private val ticketService: TicketService,
) {
    @GetMapping
    fun getAll(): List<Ticket> = ticketService.getAll()
}