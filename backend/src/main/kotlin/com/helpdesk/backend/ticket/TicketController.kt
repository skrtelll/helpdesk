package com.helpdesk.backend.ticket

import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.security.CurrentUserProvider
import jakarta.validation.Valid
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/tickets")
class TicketController(
    private val tickets: TicketService,
    private val current: CurrentUserProvider,
) {

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: CreateTicketRequest): TicketResponse =
        tickets.create(current.require(), req)

    @GetMapping
    fun list(
        @RequestParam(required = false) status: TicketStatus?,
        @RequestParam(required = false) priority: Priority?,
        @RequestParam(required = false) category: String?,
        @PageableDefault(size = 20, sort = ["createdAt"], direction = Sort.Direction.DESC) pageable: Pageable,
    ): PageResponse<TicketResponse> =
        tickets.list(current.require(), status, priority, category, pageable)

    @GetMapping("/{id}")
    fun get(@PathVariable id: UUID): TicketResponse =
        tickets.get(current.require(), id)
}
