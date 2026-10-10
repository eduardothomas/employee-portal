package com.employeeportal.data

import com.employeeportal.domain.*

/**
 * Everything the app needs from the backend. Two implementations:
 *  - [com.employeeportal.data.api.ApiPortalRepository]: real ASP.NET Core API over HTTPS
 *  - [com.employeeportal.data.demo.DemoPortalRepository]: in-memory demo with the same rules, no server
 */
interface PortalRepository {
    // Session
    suspend fun login(login: String, password: String): LoginResponse
    suspend fun verifyMfa(challengeId: String, code: String): UserSummary
    /** Restores a remembered session (refresh token). Null if there is none or it expired. */
    suspend fun restoreSession(): UserSummary?
    fun hasRememberedSession(): Boolean
    suspend fun logout()

    // Profile
    suspend fun dashboard(): Dashboard
    suspend fun me(): Me
    suspend fun updateProfile(update: UpdateProfile): Me
    suspend fun setBiometric(enabled: Boolean)
    suspend fun changePassword(current: String, new: String)
    suspend fun changeRequests(): List<ChangeRequest>
    suspend fun createChangeRequest(field: String, value: String, reason: String?): ChangeRequest

    // Payroll
    suspend fun payroll(): PayrollSummary
    suspend fun month(year: Int, month: Int): MonthDetail
    suspend fun payslips(): List<PayslipSummary>
    suspend fun payslip(id: String): PayslipDetail
    suspend fun payslipPdf(id: String): ByteArray
    suspend fun deductions(year: Int? = null, month: Int? = null): Deductions
    suspend fun decimo(): Decimo

    // Time off
    suspend fun vacations(): Vacations
    suspend fun previewVacation(from: String, to: String): VacationPreview
    suspend fun requestVacation(from: String, to: String, comment: String?): VacationRequest
    suspend fun cancelVacation(id: String)
    suspend fun leaveTypes(): List<LeaveType>
    suspend fun leaveRequests(): List<LeaveRequest>
    suspend fun requestLeave(request: CreateLeave): LeaveRequest
    suspend fun cancelLeave(id: String)

    // Documents & notifications
    suspend fun documents(): List<DocumentItem>
    suspend fun download(document: DocumentItem): ByteArray
    suspend fun notifications(): List<NotificationItem>
    suspend fun markRead(id: String)
    suspend fun markAllRead()

    // Manager
    suspend fun approvals(): Approvals
    suspend fun team(): List<TeamMember>
    /** kind = "vacations" | "leave-requests" */
    suspend fun decide(kind: String, id: String, approve: Boolean, comment: String?)
}
