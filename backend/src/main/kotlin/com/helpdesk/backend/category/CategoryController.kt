package com.helpdesk.backend.category

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/categories")
class CategoryController(private val categories: CategoryService) {

    @GetMapping
    fun list(): List<CategoryResponse> = categories.listActive()

    @GetMapping("/{id}")
    fun get(@PathVariable id: UUID): CategoryResponse = categories.get(id)
}
