package com.helpdesk.backend.common

import jakarta.servlet.http.HttpServletRequest
import org.slf4j.LoggerFactory
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException
import org.springframework.web.servlet.resource.NoResourceFoundException
import java.time.Instant

@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun validation(ex: MethodArgumentNotValidException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(422, "VALIDATION_FAILED", "Некорректные данные", req,
            ex.bindingResult.fieldErrors.map { FieldViolation(it.field, it.defaultMessage ?: "invalid") })

    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun malformed(ex: HttpMessageNotReadableException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(400, "MALFORMED_REQUEST", "Некорректный JSON или неизвестное поле", req)

    @ExceptionHandler(MethodArgumentTypeMismatchException::class)
    fun badParam(ex: MethodArgumentTypeMismatchException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(400, "INVALID_PARAMETER", "Некорректное значение параметра ${ex.name}", req)

    @ExceptionHandler(BadRequestException::class)
    fun badRequest(ex: BadRequestException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(400, ex.code, ex.message ?: "Некорректный запрос", req)

    @ExceptionHandler(UnauthorizedException::class)
    fun unauthorized(ex: UnauthorizedException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(401, "UNAUTHORIZED", ex.message ?: "Требуется аутентификация", req)

    @ExceptionHandler(ForbiddenException::class)
    fun forbidden(ex: ForbiddenException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(403, ex.code, ex.message ?: "Доступ запрещён", req)

    @ExceptionHandler(NotFoundException::class)
    fun notFound(ex: NotFoundException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(404, "NOT_FOUND", ex.message ?: "Не найдено", req)

    @ExceptionHandler(NoResourceFoundException::class)
    fun noResource(ex: NoResourceFoundException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(404, "NOT_FOUND", "Маршрут не найден", req)

    @ExceptionHandler(ConflictException::class)
    fun conflict(ex: ConflictException, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(409, ex.code, ex.message ?: "Конфликт", req)

    @ExceptionHandler(org.springframework.orm.ObjectOptimisticLockingFailureException::class)
    fun optimistic(ex: Exception, req: HttpServletRequest): ResponseEntity<ApiError> =
        build(409, "OPTIMISTIC_LOCK_CONFLICT", "Запись изменена другим запросом", req)

    @ExceptionHandler(Exception::class)
    fun unexpected(ex: Exception, req: HttpServletRequest): ResponseEntity<ApiError> {
        log.error("Unexpected error on ${req.requestURI}", ex)
        return build(500, "INTERNAL_ERROR", "Внутренняя ошибка сервера", req)
    }

    private fun build(
        status: Int,
        code: String,
        message: String,
        req: HttpServletRequest,
        fields: List<FieldViolation>? = null,
    ): ResponseEntity<ApiError> =
        ResponseEntity.status(status).body(
            ApiError(Instant.now(), status, code, message, req.requestURI, fields))
}
