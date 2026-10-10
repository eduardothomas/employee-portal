package com.employeeportal.domain

import kotlinx.serialization.Serializable

// Mirrors EmployeePortal.Contracts (backend). Dates travel as ISO strings ("yyyy-MM-dd").

@Serializable
data class UserSummary(
    val id: String,
    val employeeCode: String,
    val displayName: String,
    val fullName: String,
    val jobTitle: String,
    val role: String,
    val photoUrl: String? = null,
) {
    val isManager get() = role == "manager" || role == "hrAdmin"
}

@Serializable data class LoginResponse(val challengeId: String, val maskedDestination: String, val expiresAt: String, val devCode: String? = null)
@Serializable data class AuthTokens(val accessToken: String, val accessTokenExpiresAt: String, val refreshToken: String, val user: UserSummary)

@Serializable
data class PersonalInfo(
    val firstName: String,
    val lastName: String,
    val preferredName: String? = null,
    val nationalIdMasked: String,
    val birthDate: String? = null,
    val personalEmail: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val emergencyContactName: String? = null,
    val emergencyContactPhone: String? = null,
    val emergencyContactRelationship: String? = null,
    val photoUrl: String? = null,
)

@Serializable
data class EmploymentInfo(
    val employeeCode: String,
    val jobTitle: String,
    val department: String,
    val hireDate: String,
    val employmentType: String,
    val managerName: String? = null,
    val monthlySalary: Double,
    val workEmail: String,
)

@Serializable data class BankInfo(val bankName: String? = null, val accountType: String? = null, val maskedAccount: String? = null)

@Serializable
data class Me(
    val id: String,
    val displayName: String,
    val fullName: String,
    val role: String,
    val photoUrl: String? = null,
    val personal: PersonalInfo,
    val employment: EmploymentInfo,
    val bank: BankInfo,
    val biometricEnabled: Boolean,
    val unreadNotifications: Int,
)

@Serializable
data class UpdateProfile(
    val preferredName: String? = null,
    val personalEmail: String? = null,
    val phone: String? = null,
    val address: String? = null,
    val emergencyContactName: String? = null,
    val emergencyContactPhone: String? = null,
    val emergencyContactRelationship: String? = null,
)

@Serializable
data class ChangeRequest(
    val id: String,
    val employeeId: String,
    val employeeName: String,
    val field: String,
    val currentValue: String? = null,
    val requestedValue: String,
    val reason: String? = null,
    val status: String,
    val createdAt: String,
    val reviewedAt: String? = null,
    val reviewerName: String? = null,
    val reviewComment: String? = null,
)

@Serializable data class ActivityItem(val type: String, val icon: String, val title: String, val subtitle: String, val date: String, val link: String? = null)
@Serializable data class VacationBalance(val accrued: Double, val used: Double, val pending: Double, val available: Double)
@Serializable data class NextPay(val date: String, val estimatedNet: Double)

@Serializable
data class Dashboard(
    val displayName: String,
    val nextPay: NextPay,
    val vacation: VacationBalance,
    val pendingRequests: Int,
    val unreadNotifications: Int,
    val isManager: Boolean,
    val pendingApprovals: Int,
    val recentActivity: List<ActivityItem>,
)

@Serializable data class PayslipLine(val code: String, val description: String, val amount: Double)

@Serializable
data class PayslipSummary(
    val id: String,
    val number: String,
    val kind: String,
    val periodStart: String,
    val periodEnd: String,
    val payDate: String,
    val gross: Double,
    val deductions: Double,
    val net: Double,
)

@Serializable
data class PayslipDetail(
    val summary: PayslipSummary,
    val earnings: List<PayslipLine>,
    val deductionLines: List<PayslipLine>,
    val employeeName: String,
    val employeeCode: String,
    val jobTitle: String,
)

@Serializable data class MonthlyNet(val year: Int, val month: Int, val gross: Double, val deductions: Double, val net: Double)

@Serializable
data class PayrollSummary(
    val monthlySalary: Double,
    val nextPayDate: String,
    val nextPayEstimatedNet: Double,
    val latestPayslip: PayslipSummary? = null,
    val history: List<MonthlyNet>,
)

@Serializable
data class MonthDetail(
    val year: Int,
    val month: Int,
    val earnings: List<PayslipLine>,
    val deductionLines: List<PayslipLine>,
    val gross: Double,
    val deductions: Double,
    val net: Double,
    val payslips: List<PayslipSummary>,
)

@Serializable data class DeductionMonth(val year: Int, val month: Int, val total: Double, val byCode: Map<String, Double>)

@Serializable
data class Deductions(
    val year: Int,
    val month: Int,
    val items: List<PayslipLine>,
    val total: Double,
    val yearToDate: List<PayslipLine>,
    val history: List<DeductionMonth>,
)

@Serializable
data class Decimo(
    val nextPayDate: String,
    val periodStart: String,
    val periodEnd: String,
    val estimatedGross: Double,
    val estimatedNet: Double,
    val history: List<PayslipSummary>,
)

@Serializable data class Holiday(val date: String, val name: String)

@Serializable
data class VacationRequest(
    val id: String,
    val number: String,
    val employeeId: String,
    val employeeName: String,
    val startDate: String,
    val endDate: String,
    val days: Double,
    val comment: String? = null,
    val status: String,
    val createdAt: String,
    val reviewedAt: String? = null,
    val reviewerName: String? = null,
    val reviewComment: String? = null,
)

@Serializable
data class Vacations(
    val balance: VacationBalance,
    val upcoming: VacationRequest? = null,
    val requests: List<VacationRequest>,
    val holidays: List<Holiday>,
)

@Serializable
data class VacationPreview(
    val startDate: String,
    val endDate: String,
    val days: Int,
    val available: Double,
    val remainingAfter: Double,
    val holidaysInRange: List<Holiday>,
    val isValid: Boolean,
    val error: String? = null,
)

@Serializable
data class LeaveType(
    val id: String,
    val code: String,
    val name: String,
    val icon: String,
    val isPaid: Boolean,
    val requiresAttachment: Boolean,
    val maxDaysPerYear: Int? = null,
    val isActive: Boolean,
    val sortOrder: Int,
)

@Serializable
data class LeaveRequest(
    val id: String,
    val number: String,
    val employeeId: String,
    val employeeName: String,
    val leaveTypeId: String,
    val leaveTypeName: String,
    val leaveTypeIcon: String,
    val startDate: String,
    val endDate: String,
    val hours: Double? = null,
    val reason: String,
    val status: String,
    val createdAt: String,
    val reviewedAt: String? = null,
    val reviewerName: String? = null,
    val reviewComment: String? = null,
)

@Serializable data class CreateLeave(val leaveTypeId: String, val startDate: String, val endDate: String, val hours: Double?, val reason: String)

@Serializable
data class DocumentItem(
    val id: String,
    val category: String,
    val title: String,
    val fileName: String,
    val contentType: String,
    val sizeBytes: Long,
    val uploadedAt: String,
    val source: String,
    val downloadUrl: String,
    val employeeId: String? = null,
    val employeeName: String? = null,
)

@Serializable
data class NotificationItem(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val link: String? = null,
    val createdAt: String,
    val readAt: String? = null,
)

@Serializable
data class TeamMember(
    val id: String,
    val employeeCode: String,
    val fullName: String,
    val jobTitle: String,
    val department: String,
    val photoUrl: String? = null,
    val vacationAvailable: Double,
    val awayToday: String? = null,
    val pendingRequests: Int,
)

@Serializable data class Approvals(val vacations: List<VacationRequest>, val leaves: List<LeaveRequest>)

/** API error (RFC 7807 problem details) with optional per-field validation messages. */
class ApiException(val status: Int, override val message: String, val fieldErrors: Map<String, List<String>> = emptyMap()) : Exception(message) {
    val firstError: String get() = fieldErrors.values.firstOrNull()?.firstOrNull() ?: message
}
