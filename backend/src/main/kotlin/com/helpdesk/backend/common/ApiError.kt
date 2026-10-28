package com.helpdesk.backend.common

import java.time.Instant

data class FieldViolation(val field: String, val message: String)

data class ApiError(
    val timestamp: Instant,
    val status: Int,
    val code: String,
    val message: String,
    val path: String,
    val fieldErrors: List<FieldViolation>? = null,
)
