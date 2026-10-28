package com.helpdesk.backend.category

import com.helpdesk.backend.common.NotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
@Transactional(readOnly = true)
class CategoryService(private val categories: CategoryRepository) {

    fun listActive(): List<CategoryResponse> =
        categories.findByActiveTrueOrderByNameAsc().map { it.toResponse() }

    fun get(id: UUID): CategoryResponse =
        categories.findById(id)
            .filter { it.active }
            .orElseThrow { NotFoundException("Категория не найдена") }
            .toResponse()
}
