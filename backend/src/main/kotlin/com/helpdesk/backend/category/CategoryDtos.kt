package com.helpdesk.backend.category

import java.util.UUID

data class CategoryResponse(
    val id: UUID,
    val code: String,
    val name: String,
    val description: String?,
)

fun Category.toResponse() = CategoryResponse(
    id = id!!, code = code, name = name, description = description,
)
