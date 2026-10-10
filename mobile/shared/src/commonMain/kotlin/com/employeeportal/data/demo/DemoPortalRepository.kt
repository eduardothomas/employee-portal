package com.employeeportal.data.demo

import com.employeeportal.core.format.today
import com.employeeportal.core.platform.KeyValueStore
import com.employeeportal.data.PortalRepository
import com.employeeportal.data.demo.PanamaRules.Line
import com.employeeportal.domain.*
import kotlinx.coroutines.delay
import kotlinx.datetime.DateTimeUnit
import kotlinx.datetime.LocalDate
import kotlinx.datetime.minus
import kotlinx.datetime.number
import kotlinx.datetime.plus
import kotlin.random.Random
import kotlin.time.Clock
import kotlin.time.Duration.Companion.days

/**
 * In-memory backend with the same seed data and business rules as the real API, so the app can be
 * tried without a server. State lives for the app session; the signed-in user is remembered.
 */
class DemoPortalRepository(private val store: KeyValueStore) : PortalRepository {

    // ── in-memory model ─────────────────────────────────────────────

    private data class Emp(
        val id: String, val code: String, var firstName: String, var lastName: String, var preferredName: String? = null,
        val nationalId: String, val email: String, var phone: String?, var personalEmail: String? = null, var address: String? = "Ciudad de Panamá",
        var emergencyName: String? = null, var emergencyPhone: String? = null, var emergencyRelationship: String? = null,
        val title: String, val department: String, val hireDate: LocalDate, val managerId: String?, val salary: Double,
        val role: String, var accrued: Double, var biometric: Boolean = false, var password: String = PASSWORD,
        val bankAccount: String,
    ) {
        val fullName get() = "$firstName $lastName"
        val displayName get() = preferredName ?: firstName
    }

    private data class Slip(val id: String, val employeeId: String, val decimo: Boolean, val start: LocalDate, val end: LocalDate, val payDate: LocalDate, val lines: List<Line>)
    private class Review(var status: String = "pending", var reviewerId: String? = null, var reviewedAt: String? = null, var comment: String? = null)
    private data class Vac(val id: String, val employeeId: String, val number: String, val start: LocalDate, val end: LocalDate, val days: Int, val comment: String?, val createdAt: String, val review: Review = Review())
    private data class Leave(val id: String, val employeeId: String, val number: String, val typeId: String, val start: LocalDate, val end: LocalDate, val hours: Double?, val reason: String, val createdAt: String, val review: Review = Review())
    private data class Doc(val id: String, val employeeId: String?, val category: String, val title: String, val fileName: String, val uploadedAt: String, val paragraphs: List<String>)

    private val employees = mutableListOf<Emp>()
    private val deductions = mutableMapOf<String, List<Triple<String, String, Double>>>()
    private val slips = mutableListOf<Slip>()
    private val vacations = mutableListOf<Vac>()
    private val leaves = mutableListOf<Leave>()
    private val changes = mutableListOf<ChangeRequest>()
    private val docs = mutableListOf<Doc>()
    private val notifications = mutableListOf<NotificationItem>()
    /** notification id → employee id (the DTO has no owner field). Must be declared before init. */
    private val owners = mutableMapOf<String, String>()
    private val mfa = mutableMapOf<String, Pair<String, String>>()
    private val leaveTypes: List<LeaveType>

    private var me: Emp? = null
    private val user get() = me ?: throw ApiException(401, "No autenticado.")

    private fun uid() = Random.nextLong().toULong().toString(16) + Random.nextInt().toUInt().toString(16)
    private fun now() = Clock.System.now().toString()
    private fun daysAgo(n: Int) = (Clock.System.now() - n.days).toString()
    private fun emp(id: String?) = employees.firstOrNull { it.id == id }
    private suspend fun latency() = delay(150)

    init {
        val t = today()
        fun e(code: String, f: String, l: String, title: String, dept: String, salary: Double, role: String, mgr: Emp?, hired: String, phone: String, accrued: Double) =
            Emp(uid(), code, f, l, null, "8-${700 + employees.size * 31}-${1000 + employees.size * 977}",
                "${f.lowercase().ascii()}.${l.lowercase().ascii()}@employeeportal.dev", phone, title = title, department = dept,
                hireDate = LocalDate.parse(hired), managerId = mgr?.id, salary = salary, role = role, accrued = accrued,
                bankAccount = "04-01-99-${100000 + employees.size * 12345}").also { employees += it }

        val ricardo = e("EMP-0010", "Ricardo", "Arias", "Director General", "Dirección", 9000.0, "manager", null, "2018-01-08", "+507 6000-0010", 24.0)
        val ana = e("EMP-0003", "Ana", "Castillo", "Gerente de Recursos Humanos", "Recursos Humanos", 4800.0, "hrAdmin", ricardo, "2019-06-03", "+507 6000-0003", 18.0)
        val laura = e("EMP-0002", "Laura", "Méndez", "Engineering Manager", "Tecnología", 5200.0, "manager", ricardo, "2020-02-17", "+507 6000-0002", 15.0)
        val eduardo = e("EMP-0001", "Eduardo", "Thomas", "Software Engineer", "Tecnología", 3500.0, "employee", laura, "2023-03-01", "+507 6123-4567", 30.0)
        val diego = e("EMP-0004", "Diego", "Pérez", "Frontend Developer", "Tecnología", 2800.0, "employee", laura, "2024-01-15", "+507 6000-0004", 16.0)
        val sofia = e("EMP-0005", "Sofía", "Herrera", "QA Analyst", "Tecnología", 2200.0, "employee", laura, "2024-07-01", "+507 6000-0005", 11.0)
        e("EMP-0006", "María", "González", "Analista de Planilla", "Recursos Humanos", 2400.0, "hrAdmin", ana, "2022-09-12", "+507 6000-0006", 20.0)
        val javier = e("EMP-0007", "Javier", "Ruiz", "Contador", "Finanzas", 3000.0, "employee", ricardo, "2021-04-05", "+507 6000-0007", 22.0)
        eduardo.apply {
            personalEmail = "eduardo.thomas@example.com"; address = "Costa del Este, Ciudad de Panamá"
            emergencyName = "Carmen Thomas"; emergencyPhone = "+507 6987-6543"; emergencyRelationship = "Madre"
        }
        val seguro = Triple("SEGURO", "Seguro médico", 42.5)
        deductions[eduardo.id] = listOf(seguro, Triple("PRESTAMO", "Préstamo personal", 125.0))
        deductions[diego.id] = listOf(seguro)
        deductions[javier.id] = listOf(seguro)

        leaveTypes = listOf(
            LeaveType(uid(), "personal", "Personal", "👤", true, false, 3, true, 1),
            LeaveType(uid(), "medico", "Cita médica", "🩺", true, true, null, true, 2),
            LeaveType(uid(), "calamidad", "Calamidad doméstica", "🕯️", true, false, null, true, 3),
            LeaveType(uid(), "estudios", "Estudios", "🎓", false, false, null, true, 4),
            LeaveType(uid(), "maternidad", "Maternidad / Paternidad", "👶", true, false, null, true, 5),
            LeaveType(uid(), "otros", "Otros", "📝", true, false, null, true, 9),
        )

        // Payroll: last 16 quincenas + last 3 décimos
        val payDates = mutableListOf<LocalDate>()
        var d = PanamaRules.nextPayDate(t)
        while (payDates.size < 16) { if (d < t) payDates.add(0, d); d = PanamaRules.previousPayDate(d) }
        payDates.forEach { pay ->
            val (start, end) = PanamaRules.periodFor(pay)
            val latest = pay == payDates.last()
            employees.filter { it.hireDate <= end }.forEach { emp ->
                val isEd = emp == eduardo
                val overtime = if (isEd && pay.day > 15) (if (latest) 150.0 else 60.0 * (pay.month.number % 3)) else 0.0
                val bonus = if (isEd && latest) 200.0 else 0.0
                slips += Slip(uid(), emp.id, false, start, end, pay, PanamaRules.regular(emp.salary, bonus, overtime, deductions[emp.id].orEmpty()))
            }
        }
        listOf(t.year - 1, t.year).flatMap { y -> listOf(4, 8, 12).map { LocalDate(y, it, 15) } }.filter { it < t }.takeLast(3).forEach { pay ->
            val p = PanamaRules.decimoPeriod(pay)
            employees.filter { it.hireDate <= p.end }.forEach { slips += Slip(uid(), it.id, true, p.start, p.end, pay, PanamaRules.decimo(it.salary * 4)) }
        }

        // Vacations
        fun vac(e: Emp, number: String, start: LocalDate, end: LocalDate, comment: String?, approver: Emp?, ago: Int) =
            Vac(uid(), e.id, number, start, end, PanamaRules.workingDays(start, end), comment, daysAgo(ago),
                Review(if (approver != null) "approved" else "pending", approver?.id, approver?.let { daysAgo(ago - 1) }))
        val past = PanamaRules.nextWorkingDay(t.minus(120, DateTimeUnit.DAY))
        vacations += vac(eduardo, "VAC-${past.year}-00118", past, PanamaRules.addWorkingDays(past, 8), "Viaje familiar", laura, 150)
        if (LocalDate(t.year, 12, 15) > t) vacations += vac(eduardo, "VAC-${t.year}-00142", LocalDate(t.year, 12, 15), LocalDate(t.year, 12, 29), "Vacaciones de fin de año", null, 2)
        val ds = PanamaRules.nextWorkingDay(t.plus(21, DateTimeUnit.DAY))
        vacations += vac(diego, "VAC-${ds.year}-00143", ds, PanamaRules.addWorkingDays(ds, 5), "Boda de mi hermano", null, 1)
        val js = PanamaRules.nextWorkingDay(t.minus(2, DateTimeUnit.DAY))
        vacations += vac(javier, "VAC-${js.year}-00139", js, PanamaRules.addWorkingDays(js, 5), null, ricardo, 20)

        // Leave
        fun type(code: String) = leaveTypes.first { it.code == code }.id
        fun leave(e: Emp, code: String, number: String, date: LocalDate, hours: Double?, reason: String, approver: Emp?) =
            Leave(uid(), e.id, number, type(code), date, date, hours, reason, daysAgo(5), Review(if (approver != null) "approved" else "pending", approver?.id))
        leaves += leave(eduardo, "medico", "PER-${t.year}-00201", PanamaRules.nextWorkingDay(t.minus(35, DateTimeUnit.DAY)), 3.0, "Control anual", laura)
        leaves += leave(eduardo, "personal", "PER-${t.year}-00187", PanamaRules.nextWorkingDay(t.minus(50, DateTimeUnit.DAY)), null, "Trámite personal", laura)
        leaves += leave(eduardo, "personal", "PER-${t.year}-00215", PanamaRules.nextWorkingDay(t.plus(3, DateTimeUnit.DAY)), 2.0, "Cita personal en el banco", null)
        leaves += leave(sofia, "medico", "PER-${t.year}-00216", PanamaRules.nextWorkingDay(t.plus(5, DateTimeUnit.DAY)), 4.0, "Cita con especialista", null)

        docs += Doc(uid(), eduardo.id, "employment", "Contrato de trabajo", "contrato.pdf", daysAgo(900), listOf(
            "Entre Employee Portal S.A. (EL EMPLEADOR) y Eduardo Thomas (EL TRABAJADOR), se celebra el presente contrato de trabajo por tiempo indefinido.",
            "EL TRABAJADOR desempeñará el cargo de Software Engineer en el departamento de Tecnología, a partir del 01/03/2023.",
            "El salario será pagado en dos quincenas, los días 15 y último de cada mes, mediante transferencia bancaria.",
            "Las partes se sujetan a lo dispuesto en el Código de Trabajo de la República de Panamá."))
        docs += Doc(uid(), eduardo.id, "employment", "Carta de trabajo", "carta-de-trabajo.pdf", daysAgo(12), listOf(
            "A quien pueda interesar:",
            "Certificamos que Eduardo Thomas labora en Employee Portal S.A. desde el 01/03/2023, como Software Engineer, con un salario mensual de B/. 3,500.00.",
            "Ana Castillo — Gerente de Recursos Humanos"))
        docs += Doc(uid(), null, "other", "Reglamento interno", "reglamento-interno.pdf", daysAgo(200), listOf(
            "1. Horario: lunes a viernes de 8:00 a.m. a 5:00 p.m.",
            "2. Vacaciones: 30 días por cada 11 meses de trabajo continuo, solicitados a través del Employee Portal.",
            "3. Permisos: deben solicitarse por el portal. Los permisos médicos requieren constancia."))

        val last = payDates.last()
        fun notify(e: Emp, type: String, title: String, body: String, link: String?, at: String, read: Boolean = false) {
            notifications += NotificationItem(uid(), type, title, body, link, at, if (read) at else null).also { owners[it.id] = e.id }
        }
        notify(eduardo, "payslip", "Comprobante disponible", "Tu comprobante del ${last.day} de ${PanamaRules.MONTH_NAMES[last.month.number - 1].lowercase()} está disponible.", "payroll", daysAgo((t.toEpochDays() - last.toEpochDays()).toInt()))
        notify(eduardo, "document", "Nuevo documento", "RRHH publicó «Carta de trabajo».", "documents", daysAgo(12))
        notify(eduardo, "leave", "Permiso aprobado", "Tu permiso Cita médica fue aprobado.", "leave", daysAgo(36), read = true)
        notify(eduardo, "announcement", "Bienvenido al demo 👋", "Versión de demostración con datos ficticios. Elige «Servidor» en el inicio de sesión para usar la API real.", null, daysAgo(0))
        notify(laura, "general", "Nueva solicitud de vacaciones", "Diego Pérez solicitó vacaciones.", "approvals", daysAgo(1))

        changes += ChangeRequest(uid(), diego.id, diego.fullName, "jobTitle", diego.title, "Senior Frontend Developer", "Promoción aprobada.", "pending", daysAgo(3))
    }

    private fun String.ascii() = map { mapOf('á' to 'a', 'é' to 'e', 'í' to 'i', 'ó' to 'o', 'ú' to 'u', 'ñ' to 'n')[it] ?: it }.joinToString("")

    // ── mapping helpers ─────────────────────────────────────────────

    private fun Slip.gross() = PanamaRules.round(lines.filter { it.earning }.sumOf { it.amount })
    private fun Slip.ded() = PanamaRules.round(lines.filterNot { it.earning }.sumOf { it.amount })
    private fun Slip.summary() = PayslipSummary(id, "${if (decimo) "DEC" else "PAY"}-${payDate.toString().replace("-", "")}", if (decimo) "decimo" else "regular",
        start.toString(), end.toString(), payDate.toString(), gross(), ded(), PanamaRules.round(gross() - ded()))
    private fun Line.dto() = PayslipLine(code, description, amount)
    private fun mySlips() = slips.filter { it.employeeId == user.id }

    private fun balance(id: String): VacationBalance {
        val e = emp(id)!!
        val used = vacations.filter { it.employeeId == id && it.review.status == "approved" }.sumOf { it.days }.toDouble()
        val pending = vacations.filter { it.employeeId == id && it.review.status == "pending" }.sumOf { it.days }.toDouble()
        return VacationBalance(e.accrued, used, pending, e.accrued - used - pending)
    }

    private fun Vac.dto() = VacationRequest(id, number, employeeId, emp(employeeId)?.fullName ?: "", start.toString(), end.toString(), days.toDouble(), comment,
        review.status, createdAt, review.reviewedAt, emp(review.reviewerId)?.fullName, review.comment)

    private fun Leave.dto(): LeaveRequest {
        val t = leaveTypes.first { it.id == typeId }
        return LeaveRequest(id, number, employeeId, emp(employeeId)?.fullName ?: "", typeId, t.name, t.icon, start.toString(), end.toString(), hours, reason,
            review.status, createdAt, review.reviewedAt, emp(review.reviewerId)?.fullName, review.comment)
    }

    private fun estimateNet(e: Emp) = PanamaRules.regular(e.salary, extras = deductions[e.id].orEmpty()).let { l ->
        PanamaRules.round(l.filter { it.earning }.sumOf { it.amount } - l.filterNot { it.earning }.sumOf { it.amount })
    }

    private fun Emp.summary() = UserSummary(id, code, displayName, fullName, title, role)

    private fun notify(employeeId: String, type: String, title: String, body: String, link: String?) {
        val n = NotificationItem(uid(), type, title, body, link, now())
        notifications += n
        owners[n.id] = employeeId
    }

    private fun nextNumber(existing: List<String>, prefix: String, year: Int): String {
        val head = "$prefix-$year-"
        val max = (existing.filter { it.startsWith(head) }.mapNotNull { it.removePrefix(head).toIntOrNull() } + 100).max()
        return head + (max + 1).toString().padStart(5, '0')
    }

    private fun bad(msg: String, field: String = "general") = ApiException(400, msg, mapOf(field to listOf(msg)))

    // ── session ─────────────────────────────────────────────────────

    override suspend fun login(login: String, password: String): LoginResponse {
        latency()
        val l = login.trim().lowercase()
        val e = employees.firstOrNull { it.email == l || it.code.lowercase() == l }
        if (e == null || e.password != password) throw ApiException(401, "Usuario o contraseña incorrectos.")
        val id = uid()
        val code = Random.nextInt(0, 1_000_000).toString().padStart(6, '0')
        mfa[id] = e.id to code
        return LoginResponse(id, "•••• ${e.phone?.takeLast(4)}", now(), code)
    }

    override suspend fun verifyMfa(challengeId: String, code: String): UserSummary {
        latency()
        val (id, expected) = mfa[challengeId] ?: throw ApiException(401, "El código expiró. Inicia sesión nuevamente.")
        if (expected != code.trim()) throw ApiException(401, "Código incorrecto.")
        mfa.remove(challengeId)
        me = emp(id)
        store.set(SESSION_KEY, id)
        return user.summary()
    }

    override suspend fun restoreSession(): UserSummary? {
        me = emp(store.get(SESSION_KEY))
        return me?.summary()
    }

    override fun hasRememberedSession() = store.get(SESSION_KEY) != null

    override suspend fun logout() {
        me = null
        store.remove(SESSION_KEY)
    }

    // ── profile ─────────────────────────────────────────────────────

    override suspend fun dashboard(): Dashboard {
        latency()
        val e = user
        val mine = notifications.filter { owners[it.id] == e.id }.sortedByDescending { it.createdAt }
        val icons = mapOf("payslip" to "💰", "vacation" to "🏖️", "leave" to "📝", "document" to "📄", "profile" to "👤", "announcement" to "📣")
        return Dashboard(
            e.displayName, NextPay(PanamaRules.nextPayDate(today()).toString(), estimateNet(e)), balance(e.id),
            vacations.count { it.employeeId == e.id && it.review.status == "pending" } + leaves.count { it.employeeId == e.id && it.review.status == "pending" },
            mine.count { it.readAt == null }, e.role != "employee", approvals().let { it.vacations.size + it.leaves.size },
            mine.take(5).map { ActivityItem(it.type, icons[it.type] ?: "🔔", it.title, it.body, it.createdAt, it.link) },
        )
    }

    override suspend fun me(): Me {
        val e = user
        return Me(e.id, e.displayName, e.fullName, e.role, null,
            PersonalInfo(e.firstName, e.lastName, e.preferredName, "•".repeat(e.nationalId.length - 3) + e.nationalId.takeLast(3), "1990-05-14",
                e.personalEmail, e.phone, e.address, e.emergencyName, e.emergencyPhone, e.emergencyRelationship),
            EmploymentInfo(e.code, e.title, e.department, e.hireDate.toString(), "fullTime", emp(e.managerId)?.fullName, e.salary, e.email),
            BankInfo("Banco General", "Ahorros", "•••• ${e.bankAccount.takeLast(4)}"), e.biometric,
            notifications.count { owners[it.id] == e.id && it.readAt == null })
    }

    override suspend fun updateProfile(update: UpdateProfile): Me {
        latency()
        if (update.personalEmail?.let { it.isNotBlank() && '@' !in it } == true) throw bad("Email inválido.", "personalEmail")
        user.apply {
            update.preferredName?.let { preferredName = it.ifBlank { null } }
            update.personalEmail?.let { personalEmail = it.ifBlank { null } }
            update.phone?.let { phone = it.ifBlank { null } }
            update.address?.let { address = it.ifBlank { null } }
            update.emergencyContactName?.let { emergencyName = it.ifBlank { null } }
            update.emergencyContactPhone?.let { emergencyPhone = it.ifBlank { null } }
            update.emergencyContactRelationship?.let { emergencyRelationship = it.ifBlank { null } }
        }
        return me()
    }

    override suspend fun setBiometric(enabled: Boolean) { user.biometric = enabled }

    override suspend fun changePassword(current: String, new: String) {
        latency()
        if (current != user.password) throw bad("La contraseña actual no es correcta.", "currentPassword")
        if (new.length < 8 || new.none { it.isDigit() } || new.none { it.isLetter() }) throw bad("Mínimo 8 caracteres, con letras y números.", "newPassword")
        user.password = new
    }

    override suspend fun changeRequests() = changes.filter { it.employeeId == user.id }.reversed()

    override suspend fun createChangeRequest(field: String, value: String, reason: String?): ChangeRequest {
        latency()
        if (value.isBlank()) throw bad("Indica el nuevo valor.", "requestedValue")
        if (changes.any { it.employeeId == user.id && it.field == field && it.status == "pending" }) throw bad("Ya tienes una solicitud pendiente para este campo.", "field")
        val current = when (field) { "jobTitle" -> user.title; "department" -> user.department; "monthlySalary" -> user.salary.toString(); "bankAccount" -> "•••• ${user.bankAccount.takeLast(4)}"; else -> null }
        return ChangeRequest(uid(), user.id, user.fullName, field, current, value.trim(), reason, "pending", now()).also { changes += it }
    }

    // ── payroll ─────────────────────────────────────────────────────

    override suspend fun payroll(): PayrollSummary {
        latency()
        val regular = mySlips().filterNot { it.decimo }.sortedByDescending { it.payDate }
        val history = regular.groupBy { it.payDate.year to it.payDate.month.number }.entries.take(12).map { (k, list) ->
            MonthlyNet(k.first, k.second, PanamaRules.round(list.sumOf { it.gross() }), PanamaRules.round(list.sumOf { it.ded() }), PanamaRules.round(list.sumOf { it.gross() - it.ded() }))
        }
        return PayrollSummary(user.salary, PanamaRules.nextPayDate(today()).toString(), estimateNet(user), regular.firstOrNull()?.summary(), history)
    }

    private fun aggregate(lines: List<Line>) = lines.groupBy { it.code }.map { (code, l) -> PayslipLine(code, l.first().description, PanamaRules.round(l.sumOf { it.amount })) }

    override suspend fun month(year: Int, month: Int): MonthDetail {
        latency()
        val list = mySlips().filter { !it.decimo && it.payDate.year == year && it.payDate.month.number == month }.sortedBy { it.payDate }
        if (list.isEmpty()) throw ApiException(404, "No hay pagos para ese mes.")
        val all = list.flatMap { it.lines }
        val earnings = aggregate(all.filter { it.earning }); val ded = aggregate(all.filterNot { it.earning })
        val g = earnings.sumOf { it.amount }; val d = ded.sumOf { it.amount }
        return MonthDetail(year, month, earnings, ded, PanamaRules.round(g), PanamaRules.round(d), PanamaRules.round(g - d), list.map { it.summary() })
    }

    override suspend fun payslips(): List<PayslipSummary> { latency(); return mySlips().sortedByDescending { it.payDate }.map { it.summary() } }

    override suspend fun payslip(id: String): PayslipDetail {
        latency()
        val s = mySlips().firstOrNull { it.id == id } ?: throw ApiException(404, "Comprobante no encontrado.")
        return PayslipDetail(s.summary(), s.lines.filter { it.earning }.map { it.dto() }, s.lines.filterNot { it.earning }.map { it.dto() }, user.fullName, user.code, user.title)
    }

    override suspend fun payslipPdf(id: String): ByteArray {
        val s = mySlips().firstOrNull { it.id == id } ?: throw ApiException(404, "Comprobante no encontrado.")
        return DemoPdf.payslip(s.summary().number, s.decimo, user.fullName, user.code, user.title,
            "${s.payDate.day} de ${PanamaRules.MONTH_NAMES[s.payDate.month.number - 1].lowercase()} ${s.payDate.year}", "${s.start} - ${s.end}",
            s.lines.filter { it.earning }, s.lines.filterNot { it.earning })
    }

    override suspend fun deductions(year: Int?, month: Int?): Deductions {
        latency()
        val regular = mySlips().filterNot { it.decimo }.sortedByDescending { it.payDate }
        val y = year ?: regular.first().payDate.year
        val m = month ?: regular.first().payDate.month.number
        fun sum(list: List<Slip>) = aggregate(list.flatMap { s -> s.lines.filterNot { it.earning } })
        val items = sum(regular.filter { it.payDate.year == y && it.payDate.month.number == m })
        val ytd = sum(regular.filter { it.payDate.year == y && it.payDate.month.number <= m })
        val history = regular.groupBy { it.payDate.year to it.payDate.month.number }.entries.take(12).map { (k, list) ->
            val l = sum(list); DeductionMonth(k.first, k.second, PanamaRules.round(l.sumOf { it.amount }), l.associate { it.code to it.amount })
        }
        return Deductions(y, m, items, PanamaRules.round(items.sumOf { it.amount }), ytd, history)
    }

    override suspend fun decimo(): Decimo {
        latency()
        val p = PanamaRules.decimoPeriod(today())
        val gross = PanamaRules.estimateDecimoGross(user.salary, p, user.hireDate)
        return Decimo(p.payDate.toString(), p.start.toString(), p.end.toString(), gross, PanamaRules.round(gross - PanamaRules.round(gross * 0.0725)),
            mySlips().filter { it.decimo }.sortedByDescending { it.payDate }.map { it.summary() })
    }

    // ── time off ────────────────────────────────────────────────────

    override suspend fun vacations(): Vacations {
        latency()
        val t = today()
        val mine = vacations.filter { it.employeeId == user.id }.sortedByDescending { it.start }
        val upcoming = mine.filter { it.end >= t && it.review.status in setOf("approved", "pending") }.minByOrNull { it.start }
        val holidays = (PanamaRules.holidays(t.year) + PanamaRules.holidays(t.year + 1)).map { Holiday(it.first.toString(), it.second) }
        return Vacations(balance(user.id), upcoming?.dto(), mine.map { it.dto() }, holidays)
    }

    private fun vacationError(start: LocalDate, end: LocalDate, available: Double): String? {
        if (end < start) return "La fecha final debe ser posterior a la inicial."
        if (start < today()) return "No puedes solicitar vacaciones en fechas pasadas."
        val days = PanamaRules.workingDays(start, end)
        if (days == 0) return "El rango seleccionado no incluye días laborables."
        if (days > available) return "Solo tienes ${available.toInt()} días disponibles."
        if (vacations.any { it.employeeId == user.id && it.review.status in setOf("pending", "approved") && it.start <= end && it.end >= start })
            return "Ya tienes vacaciones solicitadas en esas fechas."
        return null
    }

    override suspend fun previewVacation(from: String, to: String): VacationPreview {
        val s = LocalDate.parse(from); val e = LocalDate.parse(to)
        val b = balance(user.id)
        val error = vacationError(s, e, b.available)
        val days = if (e >= s) PanamaRules.workingDays(s, e) else 0
        val hol = PanamaRules.holidays(s.year).filter { it.first in s..e }.map { Holiday(it.first.toString(), it.second) }
        return VacationPreview(from, to, days, b.available, b.available - days, hol, error == null, error)
    }

    override suspend fun requestVacation(from: String, to: String, comment: String?): VacationRequest {
        latency()
        val s = LocalDate.parse(from); val e = LocalDate.parse(to)
        vacationError(s, e, balance(user.id).available)?.let { throw bad(it, "startDate") }
        val v = Vac(uid(), user.id, nextNumber(vacations.map { it.number }, "VAC", s.year), s, e, PanamaRules.workingDays(s, e), comment?.ifBlank { null }, now())
        vacations += v
        user.managerId?.let { notify(it, "general", "Nueva solicitud de vacaciones", "${user.fullName} solicitó ${v.days} días.", "approvals") }
        return v.dto()
    }

    override suspend fun cancelVacation(id: String) {
        val v = vacations.firstOrNull { it.id == id && it.employeeId == user.id } ?: throw ApiException(404, "No encontrada.")
        if (v.review.status != "pending") throw bad("Solo se pueden cancelar solicitudes pendientes.")
        v.review.status = "cancelled"
    }

    override suspend fun leaveTypes() = leaveTypes.filter { it.isActive }

    override suspend fun leaveRequests(): List<LeaveRequest> { latency(); return leaves.filter { it.employeeId == user.id }.sortedByDescending { it.start }.map { it.dto() } }

    override suspend fun requestLeave(request: CreateLeave): LeaveRequest {
        latency()
        val type = leaveTypes.firstOrNull { it.id == request.leaveTypeId } ?: throw bad("Selecciona un tipo de permiso.", "leaveTypeId")
        val s = LocalDate.parse(request.startDate); val e = LocalDate.parse(request.endDate)
        if (e < s) throw bad("La fecha final debe ser posterior a la inicial.", "endDate")
        if (request.reason.isBlank()) throw bad("Describe brevemente el motivo.", "reason")
        type.maxDaysPerYear?.let { max ->
            val used = leaves.filter { it.employeeId == user.id && it.typeId == type.id && it.review.status !in setOf("rejected", "cancelled") && it.start.year == s.year }
                .sumOf { PanamaRules.workingDays(it.start, it.end) }
            if (used + PanamaRules.workingDays(s, e) > max) throw bad("Este tipo de permiso permite $max días por año (ya usaste $used).", "endDate")
        }
        val l = Leave(uid(), user.id, nextNumber(leaves.map { it.number }, "PER", s.year), type.id, s, e, request.hours, request.reason.trim(), now())
        leaves += l
        user.managerId?.let { notify(it, "general", "Nueva solicitud de permiso", "${user.fullName} solicitó un permiso (${type.name}).", "approvals") }
        return l.dto()
    }

    override suspend fun cancelLeave(id: String) {
        val l = leaves.firstOrNull { it.id == id && it.employeeId == user.id } ?: throw ApiException(404, "No encontrado.")
        if (l.review.status != "pending") throw bad("Solo se pueden cancelar solicitudes pendientes.")
        l.review.status = "cancelled"
    }

    // ── documents & notifications ───────────────────────────────────

    override suspend fun documents(): List<DocumentItem> {
        latency()
        val own = docs.filter { it.employeeId == user.id || it.employeeId == null }.sortedByDescending { it.uploadedAt }
            .map { DocumentItem(it.id, it.category, it.title, it.fileName, "application/pdf", 1500, it.uploadedAt, "document", it.id) }
        val payslips = mySlips().sortedByDescending { it.payDate }.take(12).map {
            val title = "${if (it.decimo) "Décimo" else "Comprobante"} ${it.payDate.day} ${PanamaRules.MONTH_NAMES[it.payDate.month.number - 1]} ${it.payDate.year}"
            DocumentItem(it.id, "payroll", title, "comprobante-${it.payDate}.pdf", "application/pdf", 0, it.payDate.toString(), "payslip", it.id)
        }
        return own + payslips
    }

    override suspend fun download(document: DocumentItem): ByteArray =
        if (document.source == "payslip") payslipPdf(document.id)
        else docs.first { it.id == document.id }.let { DemoPdf.letter(it.title, it.paragraphs) }

    override suspend fun notifications(): List<NotificationItem> { latency(); return notifications.filter { owners[it.id] == user.id }.sortedByDescending { it.createdAt } }

    override suspend fun markRead(id: String) {
        val i = notifications.indexOfFirst { it.id == id }
        if (i >= 0 && notifications[i].readAt == null) notifications[i] = notifications[i].copy(readAt = now())
    }

    override suspend fun markAllRead() {
        for (i in notifications.indices) {
            val n = notifications[i]
            if (owners[n.id] == user.id && n.readAt == null) notifications[i] = n.copy(readAt = now())
        }
    }

    // ── manager ─────────────────────────────────────────────────────

    private fun scope() = employees.filter { user.role == "hrAdmin" || it.managerId == user.id }.map { it.id }.toSet()

    override suspend fun approvals(): Approvals {
        if (user.role == "employee") return Approvals(emptyList(), emptyList())
        val s = scope()
        return Approvals(
            vacations.filter { it.review.status == "pending" && it.employeeId in s && it.employeeId != user.id }.sortedBy { it.start }.map { it.dto() },
            leaves.filter { it.review.status == "pending" && it.employeeId in s && it.employeeId != user.id }.sortedBy { it.start }.map { it.dto() },
        )
    }

    override suspend fun team(): List<TeamMember> {
        latency()
        val t = today()
        return employees.filter { it.managerId == user.id }.sortedBy { it.firstName }.map { e ->
            val away = when {
                vacations.any { it.employeeId == e.id && it.review.status == "approved" && t in it.start..it.end } -> "Vacaciones"
                else -> leaves.firstOrNull { it.employeeId == e.id && it.review.status == "approved" && t in it.start..it.end }?.dto()?.leaveTypeName
            }
            TeamMember(e.id, e.code, e.fullName, e.title, e.department, null, balance(e.id).available, away,
                vacations.count { it.employeeId == e.id && it.review.status == "pending" } + leaves.count { it.employeeId == e.id && it.review.status == "pending" })
        }
    }

    override suspend fun decide(kind: String, id: String, approve: Boolean, comment: String?) {
        latency()
        val (review, employeeId, label) = when (kind) {
            "vacations" -> vacations.first { it.id == id }.let { Triple(it.review, it.employeeId, "Tu solicitud ${it.number}") }
            else -> leaves.first { it.id == id }.let { Triple(it.review, it.employeeId, "Tu permiso ${it.dto().leaveTypeName}") }
        }
        if (review.status != "pending") throw bad("La solicitud ya fue procesada.")
        if (employeeId == user.id) throw ApiException(403, "No puedes aprobar tus propias solicitudes.")
        if (employeeId !in scope()) throw ApiException(403, "Solo puedes gestionar solicitudes de tu equipo.")
        review.status = if (approve) "approved" else "rejected"
        review.reviewerId = user.id
        review.reviewedAt = now()
        review.comment = comment?.ifBlank { null }
        val type = if (kind == "vacations") "vacation" else "leave"
        notify(employeeId, type, if (approve) "Solicitud aprobada" else "Solicitud rechazada", "$label fue ${if (approve) "aprobada" else "rechazada"}.", if (kind == "vacations") "time" else "leave")
    }

    private companion object {
        const val PASSWORD = "Portal2026!"
        const val SESSION_KEY = "demo.session"
    }
}
