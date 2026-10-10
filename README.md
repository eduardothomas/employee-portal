# Employee Portal

**Demo en vivo:** [App del colaborador](https://eduardothomas.github.io/employee-portal/) · [Portal RRHH](https://eduardothomas.github.io/employee-portal/admin/) — usuario `EMP-0001` o `ana.castillo@employeeportal.dev`, contraseña `Portal2026!`

Plataforma de **Employee Self-Service** para Panamá: el colaborador consulta desde su teléfono cuánto cobró, cuándo cobra, sus vacaciones, permisos, documentos y descuentos; RRHH y supervisores gestionan todo desde un portal web.

> La experiencia busca sentirse como **Apple Wallet + banca móvil + calendario**, no como un sistema tradicional de RRHH.

| App | Stack | Puerto dev |
|---|---|---|
| 📱 **Employee App** (web móvil / PWA) | React 19 + TypeScript + Vite | `5173` |
| 🖥️ **HR / Admin Portal** | React 19 + TypeScript + Vite | `5174` |
| 📲 **App móvil iOS + Android** | Kotlin Multiplatform + Compose Multiplatform | — |
| ☁️ **API** | ASP.NET Core 10 (Minimal APIs) + EF Core | `5080` |
| 🗄️ **Base de datos** | PostgreSQL 17 (o SQLite para desarrollo sin Docker) | `5432` |

---

## Inicio rápido

### Opción A — Sin Docker (SQLite, cero configuración)

```bash
cd backend/src/EmployeePortal.Api
dotnet run --launch-profile sqlite
```

```bash
cd web
npm install
npm run dev
```

- Employee App → http://localhost:5173
- Portal RRHH → http://localhost:5174
- OpenAPI → http://localhost:5080/openapi/v1.json

### Opción B — Todo con Docker (PostgreSQL)

```bash
docker compose up --build
```

- Employee App → http://localhost:8080 · Portal RRHH → http://localhost:8081 · API → http://localhost:5080

### Opción C — PostgreSQL local + API en modo desarrollo

```bash
docker compose up db -d
cd backend/src/EmployeePortal.Api && dotnet run --launch-profile postgres
```

Las migraciones se aplican y los datos demo se cargan automáticamente al arrancar.

### Usuarios demo

Contraseña para todos: **`Portal2026!`** — en desarrollo el código MFA se muestra en pantalla.

| Usuario | Rol | Para probar |
|---|---|---|
| `EMP-0001` · eduardo.thomas@employeeportal.dev | Empleado | App del colaborador completa |
| laura.mendez@employeeportal.dev | Manager | Aprobaciones (app y portal), equipo |
| ana.castillo@employeeportal.dev | RRHH / Admin | Portal completo: planillas, documentos, auditoría |

---

## Qué incluye (MVP v1)

**Employee App** — 4 tabs: *Inicio · Payroll · Tiempo · Yo*
- Login → verificación MFA (6 dígitos) → oferta de **Face ID / Touch ID** (WebAuthn) → desbloqueo biométrico en siguientes aperturas
- **Inicio**: próximo pago (tarjeta tipo Wallet, montos ocultables), vacaciones, accesos rápidos, actividad reciente, aprobaciones pendientes si eres manager
- **Payroll**: salario, comprobante más reciente, historial mensual, desglose del mes (ingresos/descuentos/neto), comprobantes por año/mes, visor PDF in-app (pdf.js) con *Compartir* y *Guardar*, protegido con biometría, descuentos con gráfico histórico y acumulado anual, **décimo tercer mes** con estimado del próximo pago
- **Tiempo**: balance (disponibles/utilizados/acumulados), próximas vacaciones, calendario con feriados de Panamá, solicitud con cálculo de días laborables en vivo y pantalla de estado, permisos por día u horas con tipos configurables
- **Yo**: perfil, información personal editable (foto, contacto, emergencia), información laboral y bancaria de solo lectura con **solicitud de modificación**, documentos, seguridad (biometría, cambio de contraseña), notificaciones

**Portal RRHH / Admin**
- Resumen con KPIs, headcount por departamento, vacaciones próximas, actividad
- Colaboradores: búsqueda, alta, edición, descuentos fijos, historial de cambios por colaborador
- Aprobaciones de vacaciones y permisos (managers ven solo su equipo)
- Solicitudes de cambio de datos
- **Planillas**: generar quincena o décimo en borrador → revisar → publicar (notifica a cada colaborador); acumulación mensual de vacaciones
- Documentos: subir para un colaborador o para toda la empresa
- Tipos de permiso (políticas), comunicaciones, **auditoría** filtrable

**API**: autenticación en dos pasos con JWT + refresh tokens rotativos (con detección de reutilización), rate limiting, roles (`Employee`, `Manager`, `HrAdmin`), ProblemDetails, auditoría de toda acción sensible, generación de PDF sin dependencias.

---

## Estructura

```
EmployeePortal/
├── backend/                       ASP.NET Core — Clean Architecture
│   ├── src/
│   │   ├── EmployeePortal.Domain          Entidades y reglas (planilla Panamá, calendario, feriados)
│   │   ├── EmployeePortal.Contracts       DTOs de la API
│   │   ├── EmployeePortal.Application     Casos de uso por módulo (servicios), validación, auditoría
│   │   ├── EmployeePortal.Infrastructure  EF Core (PostgreSQL/SQLite), JWT, PDF, seed, migraciones
│   │   └── EmployeePortal.Api             Endpoints, auth, errores, rate limiting
│   └── tests/EmployeePortal.Tests         Pruebas de dominio (xUnit)
├── web/                           npm workspaces
│   ├── packages/shared            Cliente API, auth, tipos, formatos (compartido)
│   ├── apps/employee              App del colaborador (móvil-first, PWA)
│   └── apps/admin                 Portal RRHH / Admin
├── mobile/                        App del colaborador nativa (iOS + Android) — ver mobile/README.md
├── docs/                          Arquitectura, API, decisiones, roadmap
└── docker-compose.yml
```

## Comandos útiles

```bash
cd backend && dotnet test                     # pruebas de dominio
cd web && npm run typecheck                   # TypeScript estricto en ambas apps
cd web && npm run build                       # builds de producción
dotnet ef migrations add <Nombre> --project backend/src/EmployeePortal.Infrastructure --startup-project backend/src/EmployeePortal.Api --output-dir Persistence/Migrations
```

Para reiniciar los datos demo en SQLite borra `backend/src/EmployeePortal.Api/employee_portal.db`.

## Despliegue

- **GitHub Pages** (ambas apps web): automático en cada push a `main`. Puede usar un **backend simulado en el navegador** (`demo`) o la **API real** (`api`); se elige con la variable `PAGES_BACKEND` del repositorio, sin tocar código.
- **Render** (API .NET) + **Neon** (PostgreSQL), en planes gratuitos: Blueprint `render.yaml`.

Guía paso a paso: [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

Más detalle en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md), [docs/API.md](docs/API.md), [docs/DECISIONES.md](docs/DECISIONES.md) y [docs/ROADMAP.md](docs/ROADMAP.md).
