package com.helpdesk.backend.common

import org.springframework.data.domain.Page

data class PageResponse<T>(
    val content: List<T>,
    val page: Int,
    val size: Int,
    val totalElements: Long,
    val totalPages: Int,
) {
    companion object {
        fun <T> of(page: Page<T>): PageResponse<T> =
            PageResponse(page.content, page.number, page.size, page.totalElements, page.totalPages)
    }
}
