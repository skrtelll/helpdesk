package com.helpdesk.backend.common

class NotFoundException(message: String) : RuntimeException(message)
class BadRequestException(val code: String, message: String) : RuntimeException(message)
class ConflictException(val code: String, message: String) : RuntimeException(message)
class ForbiddenException(val code: String, message: String) : RuntimeException(message)
class UnauthorizedException(message: String) : RuntimeException(message)
