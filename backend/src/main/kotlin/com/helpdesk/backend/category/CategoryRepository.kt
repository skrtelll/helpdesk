package com.helpdesk.backend.category

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface CategoryRepository : JpaRepository<Category, UUID> {

    fun findByCode(code: String): Category?

    fun existsByCode(code: String): Boolean

    fun findByActiveTrueOrderByNameAsc(): List<Category>
}
