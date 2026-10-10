package com.employeeportal.data.api

import com.employeeportal.core.platform.KeyValueStore
import com.employeeportal.data.PortalRepository
import com.employeeportal.domain.*
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.client.request.*
import io.ktor.client.statement.HttpResponse
import io.ktor.client.statement.bodyAsText
import io.ktor.http.*
import io.ktor.serialization.kotlinx.json.json
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Talks to the real API. The access token lives in memory; the refresh token (rotated on every use)
 * is persisted so the session survives app restarts. A 401 triggers one transparent refresh.
 */
class ApiPortalRepository(baseUrl: String, private val store: KeyValueStore) : PortalRepository {

    private val json = Json { ignoreUnknownKeys = true; explicitNulls = false }
    private val http = HttpClient {
        install(ContentNegotiation) { json(json) }
        defaultRequest { url(baseUrl.trimEnd('/') + "/") }
        expectSuccess = false
    }

    private var accessToken: String? = null
    private val refreshMutex = Mutex()

    private var refreshToken: String?
        get() = store.get(REFRESH_KEY)
        set(value) = if (value == null) store.remove(REFRESH_KEY) else store.set(REFRESH_KEY, value)

    // ── plumbing ────────────────────────────────────────────────────

    private suspend fun send(method: HttpMethod, path: String, body: Any? = null, retry: Boolean = true): HttpResponse {
        val response = http.request(path.trimStart('/')) {
            this.method = method
            accessToken?.let { bearerAuth(it) }
            if (body != null) {
                contentType(ContentType.Application.Json)
                setBody(body)
            }
        }
        if (response.status == HttpStatusCode.Unauthorized && retry && !path.startsWith("/auth/")) {
            if (refreshTokens() != null) return send(method, path, body, retry = false)
        }
        if (!response.status.isSuccess()) throw toException(response)
        return response
    }

    private suspend inline fun <reified T> get(path: String): T = send(HttpMethod.Get, path).body()
    private suspend inline fun <reified T> post(path: String, body: Any? = null): T = send(HttpMethod.Post, path, body).body()
    private suspend fun postUnit(path: String, body: Any? = null) { send(HttpMethod.Post, path, body) }

    private suspend fun toException(response: HttpResponse): ApiException {
        val text = runCatching { response.bodyAsText() }.getOrDefault("")
        return runCatching {
            val obj = json.parseToJsonElement(text).jsonObject
            val errors = (obj["errors"] as? JsonObject)?.mapValues { (_, v) -> v.jsonArray.map { it.jsonPrimitive.content } } ?: emptyMap()
            ApiException(response.status.value, obj["title"]?.jsonPrimitive?.content ?: "Error ${response.status.value}", errors)
        }.getOrElse {
            ApiException(response.status.value, if (response.status.value == 429) "Demasiados intentos. Espera un momento." else "No se pudo completar la solicitud.")
        }
    }

    /** Single-flight refresh: refresh tokens are single-use, so parallel callers must share one call. */
    private suspend fun refreshTokens(): AuthTokens? = refreshMutex.withLock {
        val token = refreshToken ?: return null
        val response = http.post("auth/refresh") {
            contentType(ContentType.Application.Json)
            setBody(RefreshBody(token))
        }
        if (!response.status.isSuccess()) {
            refreshToken = null
            accessToken = null
            return null
        }
        val tokens: AuthTokens = response.body()
        accessToken = tokens.accessToken
        refreshToken = tokens.refreshToken
        tokens
    }

    @Serializable private data class LoginBody(val login: String, val password: String)
    @Serializable private data class MfaBody(val challengeId: String, val code: String, val deviceName: String)
    @Serializable private data class RefreshBody(val refreshToken: String)
    @Serializable private data class PasswordBody(val currentPassword: String, val newPassword: String)
    @Serializable private data class SecurityBody(val biometricEnabled: Boolean)
    @Serializable private data class ChangeBody(val field: String, val requestedValue: String, val reason: String?)
    @Serializable private data class VacationBody(val startDate: String, val endDate: String, val comment: String?)
    @Serializable private data class ReviewBody(val comment: String?)

    // ── session ─────────────────────────────────────────────────────

    override suspend fun login(login: String, password: String): LoginResponse = post("/auth/login", LoginBody(login, password))

    override suspend fun verifyMfa(challengeId: String, code: String): UserSummary {
        val tokens: AuthTokens = post("/auth/mfa/verify", MfaBody(challengeId, code, "Employee Portal móvil"))
        accessToken = tokens.accessToken
        refreshToken = tokens.refreshToken
        return tokens.user
    }

    override suspend fun restoreSession(): UserSummary? = refreshTokens()?.user
    override fun hasRememberedSession() = refreshToken != null

    override suspend fun logout() {
        refreshToken?.let { runCatching { postUnit("/auth/logout", RefreshBody(it)) } }
        refreshToken = null
        accessToken = null
    }

    // ── profile ─────────────────────────────────────────────────────

    override suspend fun dashboard(): Dashboard = get("/me/dashboard")
    override suspend fun me(): Me = get("/me")
    override suspend fun updateProfile(update: UpdateProfile): Me = send(HttpMethod.Patch, "/me/profile", update).body()
    override suspend fun setBiometric(enabled: Boolean) { send(HttpMethod.Put, "/me/security", SecurityBody(enabled)) }
    override suspend fun changePassword(current: String, new: String) = postUnit("/auth/change-password", PasswordBody(current, new))
    override suspend fun changeRequests(): List<ChangeRequest> = get("/me/change-requests")
    override suspend fun createChangeRequest(field: String, value: String, reason: String?): ChangeRequest =
        post("/me/change-requests", ChangeBody(field, value, reason))

    // ── payroll ─────────────────────────────────────────────────────

    override suspend fun payroll(): PayrollSummary = get("/me/payroll")
    override suspend fun month(year: Int, month: Int): MonthDetail = get("/me/payroll/months/$year/$month")
    override suspend fun payslips(): List<PayslipSummary> = get("/me/payslips")
    override suspend fun payslip(id: String): PayslipDetail = get("/me/payslips/$id")
    override suspend fun payslipPdf(id: String): ByteArray = send(HttpMethod.Get, "/me/payslips/$id/pdf").body<ByteArray>()
    override suspend fun deductions(year: Int?, month: Int?): Deductions =
        get(if (year != null && month != null) "/me/deductions?year=$year&month=$month" else "/me/deductions")
    override suspend fun decimo(): Decimo = get("/me/decimo")

    // ── time off ────────────────────────────────────────────────────

    override suspend fun vacations(): Vacations = get("/me/vacations")
    override suspend fun previewVacation(from: String, to: String): VacationPreview = get("/me/vacations/preview?from=$from&to=$to")
    override suspend fun requestVacation(from: String, to: String, comment: String?): VacationRequest =
        post("/me/vacations", VacationBody(from, to, comment))
    override suspend fun cancelVacation(id: String) = postUnit("/me/vacations/$id/cancel")
    override suspend fun leaveTypes(): List<LeaveType> = get("/leave-types")
    override suspend fun leaveRequests(): List<LeaveRequest> = get("/me/leave-requests")
    override suspend fun requestLeave(request: CreateLeave): LeaveRequest = post("/me/leave-requests", request)
    override suspend fun cancelLeave(id: String) = postUnit("/me/leave-requests/$id/cancel")

    // ── documents & notifications ───────────────────────────────────

    override suspend fun documents(): List<DocumentItem> = get("/me/documents")
    override suspend fun download(document: DocumentItem): ByteArray = send(HttpMethod.Get, document.downloadUrl).body<ByteArray>()
    override suspend fun notifications(): List<NotificationItem> = get("/notifications")
    override suspend fun markRead(id: String) = postUnit("/notifications/$id/read")
    override suspend fun markAllRead() = postUnit("/notifications/read-all")

    // ── manager ─────────────────────────────────────────────────────

    override suspend fun approvals(): Approvals = get("/manager/approvals")
    override suspend fun team(): List<TeamMember> = get("/manager/team")
    override suspend fun decide(kind: String, id: String, approve: Boolean, comment: String?) =
        postUnit("/manager/$kind/$id/${if (approve) "approve" else "reject"}", ReviewBody(comment))

    private companion object {
        const val REFRESH_KEY = "api.refreshToken"
    }
}
