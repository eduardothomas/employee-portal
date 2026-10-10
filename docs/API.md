# API

Base: `http://localhost:5080` (en las apps web se accede vía `/api`). Todas las respuestas de error usan ProblemDetails (`title`, `status`, `errors{campo:[mensajes]}`).

## Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/login` | `{login, password}` → `{challengeId, maskedDestination, expiresAt, devCode?}` |
| POST | `/auth/mfa/verify` | `{challengeId, code, deviceName?}` → `{accessToken, refreshToken, user}` |
| POST | `/auth/refresh` | Rota el refresh token |
| POST | `/auth/logout` | Revoca el refresh token |
| POST | `/auth/forgot-password` | Siempre 202 |
| POST | `/auth/change-password` | 🔒 |

## Colaborador (🔒 cualquier rol)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me` | Perfil: personal, laboral, bancario (enmascarado) |
| GET | `/me/dashboard` | Agregado para Home |
| PATCH | `/me/profile` | Solo campos permitidos |
| PUT | `/me/security` | `{biometricEnabled}` |
| GET/POST | `/me/change-requests` | Solicitar cambio de datos restringidos |
| GET | `/me/payroll` | Salario, próximo pago, último comprobante, historial |
| GET | `/me/payroll/months/{year}/{month}` | Desglose mensual |
| GET | `/me/payslips?year=` | Comprobantes |
| GET | `/me/payslips/{id}` · `/pdf` | Detalle · PDF |
| GET | `/me/deductions?year=&month=` | Mes, acumulado anual, historial |
| GET | `/me/decimo` | Próximo décimo estimado e historial |
| GET | `/me/vacations` | Balance, próximas, solicitudes, feriados |
| GET | `/me/vacations/preview?from=&to=` | Días laborables y validación |
| POST | `/me/vacations` · `/{id}/cancel` | Solicitar · cancelar |
| GET | `/leave-types` | Tipos de permiso activos |
| GET/POST | `/me/leave-requests` · `/{id}/cancel` | Permisos |
| GET | `/me/documents` · `/{id}` | Documentos (incluye comprobantes) · descarga |
| GET | `/notifications` | Centro de notificaciones |
| POST | `/notifications/{id}/read` · `/read-all` | Marcar leídas |
| POST | `/devices` | Registrar dispositivo para push |

## Manager (🔒 Manager o HrAdmin)

| Método | Ruta |
|---|---|
| GET | `/manager/team` |
| GET | `/manager/approvals` |
| GET | `/manager/vacations?status=` · `/manager/leave-requests?status=` |
| POST | `/manager/vacations/{id}/approve` · `/reject` — `{comment?}` |
| POST | `/manager/leave-requests/{id}/approve` · `/reject` |

## RRHH / Admin (🔒 HrAdmin)

| Método | Ruta |
|---|---|
| GET | `/admin/dashboard` |
| GET/POST | `/admin/employees` (`search`, `department`, `active`, `page`, `pageSize`) |
| GET/PUT | `/admin/employees/{id}` |
| POST/PUT | `/admin/employees/{id}/deductions[/{deductionId}]` |
| GET | `/admin/departments` |
| POST | `/admin/vacations/accrue` |
| GET/POST/PUT | `/admin/leave-types[/{id}]` |
| GET/POST/DELETE | `/admin/documents[/{id}]` (POST multipart: `file`, `title`, `category`, `employeeId?`) |
| GET/POST | `/admin/payroll-runs` — `{kind: regular\|decimo, payDate}` |
| GET/DELETE | `/admin/payroll-runs/{id}` · POST `/publish` |
| GET | `/admin/change-requests?status=` · POST `/{id}/approve` · `/reject` |
| POST | `/admin/announcements` — `{title, body, department?}` |
| GET | `/admin/audit` (`action`, `employeeId`, `from`, `to`, `page`, `pageSize`) |
