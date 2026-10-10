package com.employeeportal.features.profile

import androidx.compose.foundation.layout.*
import androidx.compose.material3.Switch
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.employeeportal.LocalNav
import com.employeeportal.LocalSession
import com.employeeportal.core.config.LocalApp
import com.employeeportal.core.format.*
import com.employeeportal.core.platform.PlatformInfo
import com.employeeportal.designsystem.*
import com.employeeportal.domain.Me
import com.employeeportal.domain.UpdateProfile
import com.employeeportal.navigation.Routes
import kotlinx.coroutines.launch

private val ROLE_LABEL = mapOf("employee" to "Empleado", "manager" to "Manager", "hrAdmin" to "RRHH / Admin")
private val FIELD_LABEL = mapOf("jobTitle" to "Cargo", "department" to "Departamento", "monthlySalary" to "Salario", "hireDate" to "Fecha de ingreso",
    "manager" to "Supervisor", "bankAccount" to "Cuenta bancaria", "firstName" to "Nombre", "nationalId" to "Cédula")

@Composable
fun MeScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val session = LocalSession.current
    val scope = rememberCoroutineScope()
    val res = rememberResource { me() }

    Screen(Modifier.statusBarsPadding()) {
        LargeTitle("Mi perfil")
        Load(res) { me ->
            Column(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Avatar(me.fullName, 96.dp)
                T(me.fullName, 24.sp, FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                Muted(me.employment.jobTitle)
                Muted("${me.employment.employeeCode} · ${me.employment.department}", 13.sp)
            }
            SectionTitle("Información")
            ListGroup {
                ListRow("Información personal", icon = "👤", divider = false, onClick = { nav.navigate(Routes.Personal) })
                ListRow("Información laboral", icon = "💼", onClick = { nav.navigate(Routes.Employment) })
                ListRow("Información bancaria", icon = "🏦", onClick = { nav.navigate(Routes.Bank) })
            }
            Spacer(Modifier.height(24.dp))
            ListGroup {
                ListRow("Documentos", icon = "📄", divider = false, onClick = { nav.navigate(Routes.Documents) })
                ListRow("Seguridad", icon = "🔐", onClick = { nav.navigate(Routes.Security) })
                ListRow("Notificaciones", icon = "🔔", value = me.unreadNotifications.takeIf { it > 0 }?.toString(), onClick = { nav.navigate(Routes.Notifications) })
            }
            if (me.role != "employee") {
                SectionTitle(ROLE_LABEL[me.role] ?: "")
                ListGroup { ListRow("Aprobaciones y equipo", icon = "✅", divider = false, onClick = { nav.navigate(Routes.Approvals) }) }
            }
            Spacer(Modifier.height(24.dp))
            ListGroup { ListRow("Cerrar sesión", titleColor = Portal.colors.danger, divider = false, chevron = false, onClick = { scope.launch { session.logout() } }) }
            Muted("Employee Portal · v1.0 · ${PlatformInfo.name} · Servidor: ${app.mode.label}", 13.sp, Modifier.fillMaxWidth().padding(top = 24.dp))
        }
    }
}

/** "Solicitar modificación" for fields only HR can change. */
@Composable
private fun ChangeRequestSheet(field: String, current: String?, onDone: () -> Unit) {
    val app = LocalApp.current
    val toast = LocalToast.current
    val scope = rememberCoroutineScope()
    var value by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    Sheet("Modificar ${FIELD_LABEL[field]?.lowercase() ?: field}", onDone) {
        ListGroup {
            current?.let { ListRow("Valor actual", value = it, divider = false) }
            FormField("Nuevo valor", value, { value = it }, divider = current != null)
            FormField("Motivo", reason, { reason = it }, singleLine = false)
        }
        Muted("RRHH revisará tu solicitud y recibirás una notificación con la respuesta.", 13.sp, Modifier.padding(8.dp))
        error?.let { Alert(it) }
        Spacer(Modifier.height(12.dp))
        PortalButton("Enviar solicitud", enabled = value.isNotBlank(), onClick = {
            scope.launch {
                runCatching { app.repository.createChangeRequest(field, value, reason.ifBlank { null }) }
                    .onSuccess { toast.show("Solicitud enviada a RRHH"); onDone() }
                    .onFailure { error = it.userMessage() }
            }
        })
    }
}

@Composable
fun PersonalScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val toast = LocalToast.current
    val scope = rememberCoroutineScope()
    val res = rememberResource { me() }
    var form by remember { mutableStateOf<UpdateProfile?>(null) }
    var change by remember { mutableStateOf<Pair<String, String?>?>(null) }
    var busy by remember { mutableStateOf(false) }

    LaunchedEffect(res.data) {
        res.data?.personal?.let { p ->
            form = UpdateProfile(p.preferredName ?: "", p.personalEmail ?: "", p.phone ?: "", p.address ?: "", p.emergencyContactName ?: "", p.emergencyContactPhone ?: "", p.emergencyContactRelationship ?: "")
        }
    }

    fun save() = scope.launch {
        val f = form ?: return@launch
        busy = true
        runCatching { app.repository.updateProfile(f) }.onSuccess { toast.show("Cambios guardados") }.onFailure { toast.show(it.userMessage()) }
        busy = false
    }

    StackScreen("Información personal", { nav.popBackStack() }) {
        Load(res) { me: Me ->
            val f = form ?: return@Load
            SectionTitle("Datos registrados")
            ListGroup {
                ListRow("Nombre", value = "${me.personal.firstName} ${me.personal.lastName}", divider = false, onClick = { change = "firstName" to me.personal.firstName })
                ListRow("Cédula", value = me.personal.nationalIdMasked, onClick = { change = "nationalId" to me.personal.nationalIdMasked })
            }
            Muted("Para corregir estos datos se envía una solicitud a RRHH.", 13.sp, Modifier.padding(8.dp))
            SectionTitle("Contacto")
            ListGroup {
                FormField("Nombre preferido", f.preferredName ?: "", { form = f.copy(preferredName = it) }, divider = false)
                FormField("Teléfono", f.phone ?: "", { form = f.copy(phone = it) }, keyboardType = KeyboardType.Phone)
                FormField("Email personal", f.personalEmail ?: "", { form = f.copy(personalEmail = it) }, keyboardType = KeyboardType.Email)
                FormField("Dirección", f.address ?: "", { form = f.copy(address = it) }, singleLine = false)
            }
            SectionTitle("Contacto de emergencia")
            ListGroup {
                FormField("Nombre", f.emergencyContactName ?: "", { form = f.copy(emergencyContactName = it) }, divider = false)
                FormField("Teléfono", f.emergencyContactPhone ?: "", { form = f.copy(emergencyContactPhone = it) }, keyboardType = KeyboardType.Phone)
                FormField("Parentesco", f.emergencyContactRelationship ?: "", { form = f.copy(emergencyContactRelationship = it) })
            }
            Spacer(Modifier.height(24.dp))
            PortalButton("Guardar cambios", { save() }, loading = busy)
        }
    }
    change?.let { (field, current) -> ChangeRequestSheet(field, current) { change = null } }
}

@Composable
fun EmploymentScreen() {
    val nav = LocalNav.current
    val res = rememberResource { me() }
    val requests = rememberResource { changeRequests() }
    var change by remember { mutableStateOf<Pair<String, String?>?>(null) }
    val types = mapOf("fullTime" to "Tiempo completo", "partTime" to "Medio tiempo", "contractor" to "Contratista")

    StackScreen("Información laboral", { nav.popBackStack() }) {
        Load(res) { me ->
            val e = me.employment
            Spacer(Modifier.height(8.dp))
            ListGroup {
                ListRow("Código", value = e.employeeCode, divider = false)
                ListRow("Cargo", value = e.jobTitle, onClick = { change = "jobTitle" to e.jobTitle })
                ListRow("Departamento", value = e.department, onClick = { change = "department" to e.department })
                ListRow("Supervisor", value = e.managerName ?: "—", onClick = { change = "manager" to e.managerName })
                ListRow("Fecha de ingreso", value = mediumDate(e.hireDate), onClick = { change = "hireDate" to e.hireDate })
                ListRow("Tipo", value = types[e.employmentType] ?: e.employmentType)
                ListRow("Salario mensual", value = money(e.monthlySalary), onClick = { change = "monthlySalary" to money(e.monthlySalary) })
                ListRow("Email", value = e.workEmail)
            }
            Muted("Estos datos los administra RRHH. Toca un campo para solicitar una modificación.", 13.sp, Modifier.padding(8.dp))
        }
        requests.data?.takeIf { it.isNotEmpty() }?.let { list ->
            SectionTitle("Mis solicitudes de cambio")
            ListGroup {
                list.forEachIndexed { i, r -> ListRow(FIELD_LABEL[r.field] ?: r.field, "→ ${r.requestedValue}", divider = i > 0, trailing = { StatusBadge(r.status) }) }
            }
        }
    }
    change?.let { (field, current) -> ChangeRequestSheet(field, current) { change = null; requests.reload() } }
}

@Composable
fun BankScreen() {
    val nav = LocalNav.current
    val res = rememberResource { me() }
    var change by remember { mutableStateOf(false) }
    StackScreen("Información bancaria", { nav.popBackStack() }) {
        Load(res) { me ->
            Spacer(Modifier.height(8.dp))
            WalletCard {
                WalletLabel(me.bank.bankName ?: "Sin banco registrado")
                T(me.bank.maskedAccount ?: "—", 26.sp, FontWeight.Bold, androidx.compose.ui.graphics.Color.White, Modifier.padding(vertical = 12.dp))
                WalletMeta(me.bank.accountType ?: "")
            }
            Spacer(Modifier.height(24.dp))
            ListGroup {
                ListRow("Banco", value = me.bank.bankName ?: "—", divider = false)
                ListRow("Tipo de cuenta", value = me.bank.accountType ?: "—")
                ListRow("Número de cuenta", value = me.bank.maskedAccount ?: "—")
            }
            Muted("Por seguridad solo mostramos los últimos 4 dígitos. Los cambios de cuenta requieren validación de RRHH.", 13.sp, Modifier.padding(8.dp))
            Spacer(Modifier.height(16.dp))
            PortalButton("Solicitar cambio de cuenta", { change = true }, kind = ButtonKind.Secondary)
            if (change) ChangeRequestSheet("bankAccount", me.bank.maskedAccount) { change = false }
        }
    }
}

@Composable
fun DocumentsScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val res = rememberResource { documents() }
    StackScreen("Documentos", { nav.popBackStack() }) {
        LargeTitle("Documentos")
        Load(res) { docs ->
            if (docs.isEmpty()) Empty("📂", "No tienes documentos")
            listOf("employment" to "Laborales", "payroll" to "Payroll", "other" to "Otros").forEach { (key, title) ->
                val items = docs.filter { it.category == key }.take(if (key == "payroll") 6 else 50)
                if (items.isNotEmpty()) {
                    SectionTitle(title)
                    ListGroup {
                        items.forEachIndexed { i, d ->
                            ListRow(d.title, mediumDate(d.uploadedAt), icon = "📄", divider = i > 0, onClick = {
                                nav.navigate(Routes.Pdf(d.title, d.id, d.source, d.downloadUrl, d.fileName, d.source == "payslip" && app.biometricEnabled))
                            })
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun SecurityScreen() {
    val app = LocalApp.current
    val nav = LocalNav.current
    val toast = LocalToast.current
    val session = LocalSession.current
    val scope = rememberCoroutineScope()
    val label = app.biometric.availableLabel()
    var enabled by remember { mutableStateOf(app.biometricEnabled) }
    var changing by remember { mutableStateOf(false) }
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    StackScreen("Seguridad", { nav.popBackStack() }) {
        LargeTitle("Seguridad")
        ListGroup {
            ListRow(label?.let { "Desbloqueo con $it" } ?: "Biometría", if (label != null) "Desbloqueo y comprobantes protegidos" else "No disponible en este dispositivo",
                icon = "🔒", divider = false, chevron = false, trailing = {
                    Switch(enabled, enabled = label != null, onCheckedChange = { on ->
                        scope.launch {
                            if (on && !app.biometric.authenticate("Activa el desbloqueo biométrico")) return@launch
                            app.biometricEnabled = on
                            enabled = on
                            runCatching { app.repository.setBiometric(on) }
                            toast.show(if (on) "$label activado" else "$label desactivado")
                        }
                    })
                })
            ListRow("Cambiar contraseña", icon = "🔑", onClick = { changing = true })
            ListRow("Verificación en dos pasos", "Código en cada inicio de sesión", icon = "📲", chevron = false, trailing = { StatusBadge("approved", "Activa") })
        }
        Spacer(Modifier.height(24.dp))
        ListGroup { ListRow("Cerrar sesión en este dispositivo", titleColor = Portal.colors.danger, divider = false, chevron = false, onClick = { scope.launch { session.logout() } }) }
    }

    if (changing) {
        Sheet("Cambiar contraseña", { changing = false }) {
            ListGroup {
                PasswordField("Contraseña actual", current, { current = it }, divider = false)
                PasswordField("Nueva contraseña", next, { next = it })
            }
            Muted("Mínimo 8 caracteres, con letras y números.", 13.sp, Modifier.padding(8.dp))
            error?.let { Alert(it) }
            Spacer(Modifier.height(12.dp))
            PortalButton("Actualizar", {
                scope.launch {
                    runCatching { app.repository.changePassword(current, next) }
                        .onSuccess { toast.show("Contraseña actualizada"); changing = false; current = ""; next = "" }
                        .onFailure { error = it.userMessage() }
                }
            })
        }
    }
}

@Composable
private fun PasswordField(label: String, value: String, onChange: (String) -> Unit, divider: Boolean = true) {
    Column(Modifier.padding(if (divider) PaddingValues(0.dp) else PaddingValues(0.dp))) {
        Muted(label, 13.sp, Modifier.padding(start = 16.dp, top = 10.dp))
        Box(Modifier.padding(horizontal = 8.dp, vertical = 6.dp)) { TextInput(value, onChange, "••••••••", password = true) }
    }
}
