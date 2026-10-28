package com.helpdesk.backend.comment

import com.helpdesk.backend.security.CurrentUserProvider
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/tickets/{ticketId}/comments")
class CommentController(
    private val comments: CommentService,
    private val current: CurrentUserProvider,
) {

    @GetMapping
    fun list(@PathVariable ticketId: UUID): List<CommentResponse> =
        comments.list(current.require(), ticketId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun add(@PathVariable ticketId: UUID, @Valid @RequestBody req: CommentRequest): CommentResponse =
        comments.add(current.require(), ticketId, req)
}
