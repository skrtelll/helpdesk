package com.helpdesk

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableAsync

@SpringBootApplication
@EnableAsync
class HelpDeskApplication

fun main(args: Array<String>) {
    runApplication<HelpDeskApplication>(*args)
}