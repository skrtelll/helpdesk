package com.helpdesk.backend.admin

import com.helpdesk.backend.category.Category
import com.helpdesk.backend.category.CategoryRepository
import com.helpdesk.backend.common.ConflictException
import com.helpdesk.backend.common.NotFoundException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.data.domain.Sort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class AdminCategoryService(private val categories: CategoryRepository) {

    @Transactional(readOnly = true)
    fun list(): List<AdminCategoryResponse> =
        categories.findAll(Sort.by("code")).map { it.toAdminResponse() }

    @Transactional
    fun create(req: CreateCategoryRequest): AdminCategoryResponse {
        if (categories.existsByCode(req.code!!)) throw codeTaken()
        val category = Category().apply {
            code = req.code
            name = req.name!!
            description = req.description
            active = true
        }
        return try {
            categories.saveAndFlush(category).toAdminResponse()
        } catch (e: DataIntegrityViolationException) {
            throw codeTaken() // гонка двух создаёт одинаковый code
        }
    }

    @Transactional
    fun update(id: UUID, req: UpdateCategoryRequest): AdminCategoryResponse {
        val category = load(id)
        req.name?.let { category.name = it }
        req.description?.let { category.description = it }
        return category.toAdminResponse()
    }

    /** Физического удаления нет (BR-010). Существующие заявки сохраняют категорию. */
    @Transactional
    fun setActive(id: UUID, active: Boolean): AdminCategoryResponse {
        val category = load(id)
        category.active = active
        return category.toAdminResponse()
    }

    private fun load(id: UUID): Category =
        categories.findById(id).orElseThrow { NotFoundException("Категория не найдена") }

    private fun codeTaken() = ConflictException("CATEGORY_CODE_EXISTS", "Категория с таким кодом уже существует")

    private fun Category.toAdminResponse() = AdminCategoryResponse(
        id = id!!,
        code = code,
        name = name,
        description = description,
        active = active,
        createdAt = createdAt!!,
        updatedAt = updatedAt!!,
    )
}