package com.helpdesk.backend.user

import com.helpdesk.backend.common.NotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class UserService(private val users: UserRepository) {

    @Transactional
    fun updateDisplayName(current: User, displayName: String): UserResponse {
        val user = users.findById(current.id!!)
            .orElseThrow { NotFoundException("Пользователь не найден") }
        user.displayName = displayName
        return user.toResponse()
    }
}
