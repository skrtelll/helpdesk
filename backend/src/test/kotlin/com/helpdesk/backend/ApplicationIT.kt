package com.helpdesk.backend

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.client.TestRestTemplate
import org.springframework.context.annotation.Import
import org.springframework.http.HttpStatus

/**
 * Поднимает приложение целиком на реальном PostgreSQL: миграции, валидация схемы Hibernate,
 * веб-слой. Падает, если backend не стартует так же, как упал бы в Docker.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(TestcontainersConfiguration::class)
class ApplicationIT {

    @Autowired
    lateinit var rest: TestRestTemplate

    @Test
    fun healthIsUp() {
        val response = rest.getForEntity("/health", Map::class.java)
        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(response.body?.get("status")).isEqualTo("UP")
    }

    @Test
    fun openApiIsServed() {
        val response = rest.getForEntity("/v3/api-docs", String::class.java)
        assertThat(response.statusCode).isEqualTo(HttpStatus.OK)
    }
}
