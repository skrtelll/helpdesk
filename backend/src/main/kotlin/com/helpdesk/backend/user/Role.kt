package com.helpdesk.backend.user

/** Роли системы. Значения совпадают с CHECK ck_users_role. */
enum class Role {
    USER,
    SUPPORT,
    ADMIN;

    fun isStaff(): Boolean = this == SUPPORT || this == ADMIN
}
