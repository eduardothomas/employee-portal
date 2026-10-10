package com.employeeportal.navigation

import kotlinx.serialization.Serializable

/** Type-safe destinations (Navigation Compose). Tab roots show the tab bar; the rest are pushed screens. */
object Routes {
    @Serializable data object Home
    @Serializable data object Payroll
    @Serializable data object Time
    @Serializable data object Me

    @Serializable data object Notifications
    @Serializable data object Approvals
    @Serializable data class Month(val year: Int, val month: Int)
    @Serializable data object Payslips
    @Serializable data class Payslip(val id: String)
    @Serializable data object Deductions
    @Serializable data object Decimo
    @Serializable data object VacationNew
    @Serializable data object Leave
    @Serializable data object LeaveNew
    @Serializable data object Personal
    @Serializable data object Employment
    @Serializable data object Bank
    @Serializable data object Documents
    @Serializable data object Security
    @Serializable data class Pdf(val title: String, val id: String, val source: String, val downloadUrl: String, val fileName: String, val protect: Boolean)
}
