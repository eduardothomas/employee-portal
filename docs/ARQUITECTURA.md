# Arquitectura

## Visión general

```
 ┌──────────────────┐    ┌──────────────────┐
 │  Employee App    │    │  HR/Admin Portal │     React + TS (Vite)
 │  (móvil, PWA)    │    │  (escritorio)    │     comparten @ep/shared
 └────────┬─────────┘    └────────┬─────────┘
          │  /api/* (proxy Vite / nginx)  │
          └──────────────┬────────────────┘
                         ▼
               ┌──────────────────┐
               │  EmployeePortal  │  ASP.NET Core 10 · Minimal APIs
               │      .Api        │  JWT · roles · rate limit · ProblemDetails
               └────────┬─────────┘
                        ▼
               ┌──────────────────┐
               │   Application    │  Servicios por módulo · validación · auditoría · notificaciones
               └────────┬─────────┘
                        ▼
      ┌─────────────────┴───────────────┐
      ▼                                 ▼
┌───────────┐                   ┌────────────────┐
│  Domain   │                   │ Infrastructure │  EF Core · Npgsql/SQLite · JWT · PDF · seed
└───────────┘                   └───────┬────────┘
                                        ▼
                                  PostgreSQL
```

## Backend

**Dependencias**: `Api → Infrastructure → Application → Domain + Contracts`. El dominio no depende de nada.

| Capa | Responsabilidad |
|---|---|
| **Domain** | Entidades (`Employee`, `Payslip`, `VacationRequest`, `LeaveRequest`, `Document`, `Notification`, `AuditLog`…), `ReviewableRequest` (aprobación con reglas: no auto-aprobar, no decidir dos veces), reglas de Panamá: `PanamaPayroll` (CSS, Seguro Educativo, ISR), `PayCalendar` (15 y fin de mes), `DecimoCalendar`, `WorkCalendar` (feriados nacionales con Pascua y traslado de domingo a lunes, días laborables, 30 días/11 meses). |
| **Contracts** | Records de request/response. Enums viajan como strings camelCase, fechas como `yyyy-MM-dd`. |
| **Application** | Un servicio por módulo (`AuthService`, `PayrollService`, `TimeOffService`, `ApprovalService`, `DocumentService`, `AdminService`, `PayrollRunService`…). `AuditTrail` y `Notifier` agregan registros en la misma unidad de trabajo que el cambio. Errores tipados → HTTP. |
| **Infrastructure** | `AppDbContext` (configuraciones, índices, conversión de enums a texto, DateTime siempre UTC), migraciones PostgreSQL, `TokenService` (JWT HS256 + refresh tokens hasheados con HMAC), `PasswordService` (PBKDF2 de ASP.NET Identity), `PdfRenderer` (PDF 1.4 sin librerías), `DataSeeder` (datos relativos a la fecha actual). |
| **Api** | Endpoints agrupados por módulo, políticas `Manager` y `HrAdmin`, manejador global de excepciones, headers de seguridad, OpenAPI. |

### Modelo de datos

```
Employee ──┬── RecurringDeduction         (descuentos fijos por quincena)
           ├── Payslip ── PayslipLine     (ingresos / deducciones)   ← PayrollRun (borrador → publicada)
           ├── VacationRequest            (VAC-2026-00142)
           ├── LeaveRequest ── LeaveType  (PER-2026-00215, tipos configurables)
           ├── ChangeRequest              (datos no editables por el colaborador)
           ├── Document ── DocumentFile   (blob separado; null EmployeeId = toda la empresa)
           ├── Notification / Device
           ├── MfaChallenge / RefreshToken
           └── Employee (Manager)
AuditLog  (append-only: actor, acción, entidad, colaborador afectado, detalle JSON, IP)
```

### Seguridad

- **Login en dos pasos**: contraseña → código de 6 dígitos (hash, 5 min, 5 intentos) → tokens.
- **Access token** JWT de 15 min en memoria del navegador; **refresh token** opaco, rotado en cada uso, guardado hasheado. Reutilizar un token rotado fuera de la ventana de gracia revoca todas las sesiones.
- **Autorización por recurso**: todo `/me/*` filtra por el usuario del token; managers solo deciden sobre reportes directos; nadie aprueba sus propias solicitudes.
- **Rate limiting** en `/auth/*`, errores de login genéricos (sin enumeración de usuarios), `forgot-password` siempre responde 202.
- **Datos sensibles**: cuenta bancaria y cédula enmascaradas para el colaborador; salario/banco solo cambian vía RRHH (auditado).
- **Auditoría** de login, fallos de MFA, cambios de perfil, salario, aprobaciones, descargas de documentos y comprobantes, planillas y comunicados.

## Frontend

- `@ep/shared`: `ApiClient` (refresh automático y deduplicado), `AuthProvider`, `useResource`, tipos espejo de los contratos, formatos en español.
- **Employee App**: layout tipo iOS — tabs raíz con tab bar; pantallas de detalle "empujadas" con barra de navegación y botón Atrás. Sistema de diseño en `styles.css` con tokens y modo oscuro. Biometría vía **WebAuthn** (autenticador de plataforma). pdf.js se carga bajo demanda.
- **Portal RRHH**: sidebar, tablas densas, modales; la navegación se adapta al rol (Manager solo ve Aprobaciones y Equipo).
