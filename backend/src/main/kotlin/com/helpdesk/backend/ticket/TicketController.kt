package com.helpdesk.backend.ticket

import com.helpdesk.backend.common.PageResponse
import com.helpdesk.backend.history.HistoryResponse
import com.helpdesk.backend.security.CurrentUserProvider
import jakarta.validation.Valid
import org.springframework.data.domain.Pageable
import org.springframework.data.domain.Sort
import org.springframework.data.web.PageableDefault
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
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
    ): PageResponse<TicketSummary> =
        tickets.list(current.require(), status, priority, category, pageable)

    @GetMapping("/{id}")
    fun get(@PathVariable id: UUID): TicketResponse =
        tickets.get(current.require(), id)

    @PostMapping("/{id}/take")
    fun take(@PathVariable id: UUID, @Valid @RequestBody req: VersionRequest): TicketResponse =
        tickets.take(current.require(), id, req.version!!)

    @PostMapping("/{id}/assign")
    fun assign(@PathVariable id: UUID, @Valid @RequestBody req: AssignRequest): TicketResponse =
        tickets.assign(current.require(), id, req)

    @PostMapping("/{id}/cancel")
    fun cancel(@PathVariable id: UUID, @Valid @RequestBody req: VersionRequest): TicketResponse =
        tickets.cancel(current.require(), id, req.version!!)

    @PostMapping("/{id}/close")
    fun close(@PathVariable id: UUID, @Valid @RequestBody req: VersionRequest): TicketResponse =
        tickets.close(current.require(), id, req.version!!)

    @PatchMapping("/{id}/status")
    fun changeStatus(@PathVariable id: UUID, @Valid @RequestBody req: ChangeStatusRequest): TicketResponse =
        tickets.changeStatus(current.require(), id, req)

    @PatchMapping("/{id}/priority")
    fun changePriority(@PathVariable id: UUID, @Valid @RequestBody req: ChangePriorityRequest): TicketResponse =
        tickets.changePriority(current.require(), id, req)

    @PatchMapping("/{id}/category")
    fun changeCategory(@PathVariable id: UUID, @Valid @RequestBody req: ChangeCategoryRequest): TicketResponse =
        tickets.changeCategory(current.require(), id, req)

    @GetMapping("/{id}/history")
    fun history(@PathVariable id: UUID): List<HistoryResponse> =
        tickets.history(current.require(), id)
}