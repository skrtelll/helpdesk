package com.helpdesk.backend

import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.testcontainers.service.connection.ServiceConnection
import org.springframework.context.annotation.Bean
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName

/**
 * Общий PostgreSQL для интеграционных тестов: подключается через @Import(TestcontainersConfiguration::class).
 * Spring сам прописывает datasource из контейнера (@ServiceConnection), а тесты с одинаковым
 * контекстом переиспользуют один и тот же контейнер.
 */
@TestConfiguration(proxyBeanMethods = false)
class TestcontainersConfiguration {

    @Bean
    @ServiceConnection
    fun postgres(): PostgreSQLContainer<*> = PostgreSQLContainer(DockerImageName.parse("postgres:16-alpine"))
}
