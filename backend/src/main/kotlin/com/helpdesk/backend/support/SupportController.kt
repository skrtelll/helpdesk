package com.helpdesk.backend.support

import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.security.CurrentUserProvider
import com.helpdesk.backend.ticket.Priority
import com.helpdesk.backend.ticket.TicketStatus
import com.helpdesk.backend.ticket.TicketSummary
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/support")
class SupportController(
    private val queue: SupportQueueService,
    private val current: CurrentUserProvider,
) {

    @GetMapping("/queue")
    fun queue(
        @RequestParam(required = false) category: String?,
        @RequestParam(required = false) priority: Priority?,
        @RequestParam(required = false) unassigned: Boolean?,
        @PageableDefault(size = 20) pageable: Pageable,
    ): PageResponse<TicketSummary> =
        queue.queue(category, priority, unassigned == true, pageable)

    @GetMapping("/my-tickets")
    fun myTickets(
        @RequestParam(required = false) status: TicketStatus?,
        @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC) pageable: Pageable,
    ): PageResponse<TicketSummary> =
        queue.myTickets(current.require(), status, pageable)
}