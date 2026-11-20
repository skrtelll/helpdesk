package com.helpdesk.backend.admin

import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/admin/categories")
class AdminCategoryController(private val categories: AdminCategoryService) {

    @GetMapping
    fun list(): List<AdminCategoryResponse> = categories.list()

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@Valid @RequestBody req: CreateCategoryRequest): AdminCategoryResponse = categories.create(req)

    @PatchMapping("/{categoryId}")
    fun update(
        @PathVariable categoryId: UUID,
        @Valid @RequestBody req: UpdateCategoryRequest,
    ): AdminCategoryResponse = categories.update(categoryId, req)

    @PatchMapping("/{categoryId}/active")
    fun setActive(
        @PathVariable categoryId: UUID,
        @Valid @RequestBody req: SetCategoryActiveRequest,
    ): AdminCategoryResponse = categories.setActive(categoryId, req.active!!)
}