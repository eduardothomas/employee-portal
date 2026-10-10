# Despliegue

```
                      ┌──────────────────────── modo "demo" ───────────────────────┐
GitHub Pages (front)  │  backend simulado dentro del navegador (sin servidor)      │
https://eduardothomas.github.io/employee-portal/          ← app del colaborador
https://eduardothomas.github.io/employee-portal/admin/    ← portal RRHH
                      └──────────────────────── modo "api" ────────────────────────┘
                                   │ HTTPS
                                   ▼
                      Render, plan Free (API .NET, Docker)  ──TLS──▶  Neon, plan Free (PostgreSQL)
                      https://employee-portal-api.onrender.com          postgresql://…neon.tech/…
```

| Qué | Dónde se despliega | Cómo |
|---|---|---|
| App del colaborador + portal RRHH (web estática) | **GitHub Pages** | Automático con GitHub Actions en cada push a `main` (`.github/workflows/pages.yml`) |
| Pruebas del backend y typecheck del front | **GitHub Actions** | Automático en cada push / PR (`.github/workflows/ci.yml`) |
| API ASP.NET Core | **Render** | Blueprint `render.yaml`; Render redespliega solo en cada push a `main` |
| Base de datos PostgreSQL | **Neon** | Proyecto gratuito; la API crea las tablas y los datos demo al arrancar |

GitHub Pages solo sirve archivos estáticos: no puede ejecutar la API .NET ni PostgreSQL. Por eso el backend va en Render.

---

## Elegir el backend del sitio publicado

El front tiene un interruptor, `VITE_BACKEND`:

| Valor | Qué hace | Cuándo usarlo |
|---|---|---|
| `demo` | Backend simulado dentro del navegador, con los mismos datos y reglas de negocio. Cada visitante tiene su propia copia, guardada en su navegador (botón *Reiniciar demo*). | Para compartir el proyecto sin depender de ningún servidor. Es el valor por defecto. |
| `api` | Usa la API real en `VITE_API_URL` (Render). Todos los visitantes comparten los mismos datos. | Cuando la API ya esté desplegada en Render. |

**Cómo cambiarlo sin tocar código.** El primero que exista gana:

1. **Una sola vez**: GitHub → *Actions* → **Deploy GitHub Pages** → *Run workflow* → `backend: demo` o `api`.
2. **Permanente**: GitHub → *Settings → Secrets and variables → Actions → Variables*:
   - `PAGES_BACKEND` = `demo` o `api`
   - `PAGES_API_URL` = `https://employee-portal-api.onrender.com` (la URL real de tu servicio, sin `/` al final)

   Después vuelve a ejecutar el workflow (paso 1 con `default`) o haz un push.
3. **Valor por defecto en el repositorio**: `web/.env.production` (`VITE_BACKEND` y `VITE_API_URL`).

En desarrollo local, `web/.env` controla lo mismo: `VITE_BACKEND=demo` permite probar las apps sin levantar la API.

---

## Paso a paso: API en Render + base de datos en Neon

### 1. Base de datos en Neon (gratis)

1. Entra a https://neon.com y crea una cuenta (puedes usar tu cuenta de GitHub).
2. **Create project** → nombre `employee-portal`, Postgres 17, región **AWS US East (Ohio)**. Render Free en Ohio queda cerca.
3. En *Connection Details* copia la **connection string**, que se ve así: `postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`.
   Guárdala: la pegarás en Render. No hace falta crear tablas.

### 2. API en Render (gratis, con el Dockerfile del repo)

1. Entra a https://render.com → **Get Started** → regístrate con **GitHub**.
2. **New → Blueprint** → autoriza a Render a leer tus repos → elige `eduardothomas/employee-portal`.
3. Render lee `render.yaml` y crea el servicio `employee-portal-api`. Te pide dos valores:
   - `ConnectionStrings__Default` → pega la cadena de Neon tal cual.
   - `Cors__Origins` → `https://eduardothomas.github.io` (solo el origen, sin `/employee-portal`).
4. **Apply**. El primer build tarda unos 5 minutos.
5. Cuando diga *Live*, abre `https://employee-portal-api.onrender.com/health`. Debe responder `{"status":"ok"}`.
   Si Render le asignó otro nombre, usa esa URL en el paso 3.

`Jwt__SigningKey` lo genera Render automáticamente. `Auth__ExposeMfaCodeInResponse=true` muestra el código MFA en pantalla porque todavía no hay envío por SMS/email (solo para demo).

### 3. Conectar GitHub Pages con la API

1. GitHub → repo → *Settings → Secrets and variables → Actions → Variables → New repository variable*:
   - `PAGES_API_URL` = `https://employee-portal-api.onrender.com`
   - `PAGES_BACKEND` = `api`
2. *Actions → Deploy GitHub Pages → Run workflow*.
3. Abre https://eduardothomas.github.io/employee-portal/. Si la API estaba dormida, aparece *"Despertando el servidor…"* durante cerca de un minuto.

Para volver al demo: cambia `PAGES_BACKEND` a `demo` y vuelve a ejecutar el workflow.

---

## Dónde se configura cada cosa (un solo lugar por dato)

| Dato | Lugar |
|---|---|
| Modo del front (demo / api) | Variable `PAGES_BACKEND` en GitHub (por defecto: `web/.env.production`) |
| URL de la API que usa el front | Variable `PAGES_API_URL` en GitHub (por defecto: `web/.env.production`) |
| Cadena de conexión a la base de datos | `ConnectionStrings__Default` en Render |
| Origen permitido del front (CORS) | `Cors__Origins` en Render |
| Clave JWT | `Jwt__SigningKey` en Render (generada) |

`appsettings.json` solo trae valores de desarrollo local. En producción las variables de entorno los reemplazan (en ASP.NET Core `__` equivale a `:`), así que **no hay secretos en el repositorio**.

## Mover de hosting más adelante

- **API** (Azure, Koyeb, Cloud Run…): despliega el mismo `backend/Dockerfile` con las mismas variables de entorno y cambia solo `PAGES_API_URL`. La API escucha en el puerto que indique la plataforma (`PORT`).
- **Base de datos**: cambia solo `ConnectionStrings__Default` en el hosting de la API.

## Limitaciones de los planes gratuitos

- **Render Free** se duerme tras unos 15 minutos sin tráfico, y la primera petición después tarda cerca de un minuto. Tiene 512 MB de RAM y 750 horas al mes.
- **Neon Free** suspende el cómputo tras 5 minutos inactivo (reactivarse es rápido) y tiene límites de almacenamiento.
- **Render Postgres Free** expira a los 30 días; por eso se usa Neon.
- **Modo demo**: los datos viven en el navegador de cada visitante y se borran si limpia los datos del sitio.

## Probar el build de Pages en local

```bash
cd web
REPO_NAME=employee-portal scripts/build-pages.sh          # usa web/.env.production
node scripts/serve-pages.mjs employee-portal               # http://localhost:4180/employee-portal/
```

`VITE_BACKEND=api VITE_API_URL=http://localhost:5080 REPO_NAME=employee-portal scripts/build-pages.sh` construye contra una API local. Para esa prueba, agrega `http://localhost:4180` a `Cors:Origins`.
