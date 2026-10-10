# Roadmap

## v1 (este repositorio) ✅
Login + MFA + biometría · Dashboard · Payroll (salario, comprobantes, historial, descuentos, décimo) · Vacaciones y permisos · Perfil · Documentos con visor PDF · Notificaciones · Portal RRHH (colaboradores, aprobaciones, planillas, documentos, políticas, comunicados, auditoría).

## v1.1 — endurecimiento para producción
- Envío real de MFA (SMS/Email: Twilio, AWS SNS, SendGrid) y flujo completo de restablecimiento de contraseña
- Passkeys (WebAuthn verificado en servidor) como alternativa al password
- Web Push / APNs usando `/devices`
- Almacenamiento de documentos en S3/Azure Blob; antivirus en uploads
- Cookies `HttpOnly` para el refresh token; CSP estricta
- Job programado de acumulación de vacaciones (Hangfire / Quartz) y cálculo desde fecha de ingreso
- Pruebas de integración de la API (WebApplicationFactory + Testcontainers PostgreSQL) y E2E (Playwright)
- Observabilidad: OpenTelemetry, logs estructurados, health checks de BD

## v2
Calendario laboral · solicitudes avanzadas (adjuntos en permisos médicos) · cartas laborales automáticas · firma digital · chat con RRHH · encuestas · beneficios y seguros · préstamos y adelantos de salario · onboarding · prima de antigüedad e indemnizaciones · reportes exportables (planilla CSS/SIPE).

## Más adelante
🤖 **Asistente con IA** sobre los mismos endpoints `/me/*`: "¿Cuántos días de vacaciones tengo?", "¿Cuánto me descontaron de CSS este año?", "¿Cuándo me toca el próximo décimo?".
