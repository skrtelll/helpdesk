package com.helpdesk.backend

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication

/**
 * HelpDesk backend — точка входа.
 *
 * Архитектура: Controller -> Service -> Repository (см. ТЗ, п.11).
 * Пакеты организованы по доменам: user, category, ticket, comment, history, ml.
 */
@SpringBootApplication
class BackendApplication

fun main(args: Array<String>) {
    runApplication<BackendApplication>(*args)
}
