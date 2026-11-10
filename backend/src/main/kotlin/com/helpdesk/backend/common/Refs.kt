package com.helpdesk.backend.common

import java.util.UUID

data class UserRef(val id: UUID, val displayName: String)
data class CategoryRef(val code: String, val name: String)
