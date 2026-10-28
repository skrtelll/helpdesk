package com.helpdesk.backend.common

import org.springframework.data.domain.Pageable

/** Не даём передать в ORDER BY произвольное имя поля (REST-контракт, п.7). */
object SortWhitelist {
    fun validate(pageable: Pageable, allowed: Set<String>) {
        pageable.sort.forEach { order ->
            if (order.property !in allowed)
                throw BadRequestException("INVALID_SORT", "Недопустимое поле сортировки: ${order.property}")
        }
    }
}
