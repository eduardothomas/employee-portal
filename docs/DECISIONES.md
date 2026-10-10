# Decisiones de producto y técnicas

## 1. Employee App como web móvil (no SwiftUI)
El blueprint original planteaba la app del colaborador en SwiftUI. Se decidió construirla **como web** (móvil-first, instalable como PWA) para tener un solo stack de frontend con el portal de RRHH. La arquitectura respeta la intención del blueprint: capas Core / DesignSystem / Domain / Features se reflejan en `@ep/shared` (core, tipos), `styles.css` (design system) y `pages/*` (features). La API es agnóstica: una app nativa futura consume exactamente los mismos endpoints.

## 2. Dirección visual
- **Employee App → "Apple / Premium"** con toques **Fintech**: tarjetas tipo Wallet para dinero, tipografía del sistema, mucho espacio, tab bar translúcida, hojas modales desde abajo, modo oscuro automático.
- **Portal RRHH → "Enterprise Modern"**: sidebar oscuro, tablas densas, KPIs, mismo azul de marca.

## 3. Reglas de Panamá (simplificadas, centralizadas en `Domain/Payroll/PanamaPayroll.cs`)
| Regla | Implementación |
|---|---|
| Pago | Quincenal: día 15 y último día del mes |
| CSS (empleado) | 9.75% del bruto |
| Seguro Educativo | 1.25% del bruto |
| ISR | Proyección anual = salario × 13; 0% hasta B/.11,000; 15% sobre el excedente hasta B/.50,000; B/.5,850 + 25% sobre el excedente. Retención = impuesto anual ÷ 26 |
| Décimo tercer mes | 3 partidas (15 abr, 15 ago, 15 dic), cada una = 1/12 de lo devengado en su período; CSS 7.25% |
| Vacaciones | 30 días por cada 11 meses (2.73 días/mes); las solicitudes cuentan **días laborables** (excluye fines de semana y feriados) |
| Feriados | Nacionales, incluye Carnaval y Viernes Santo (calculados desde Pascua); si caen domingo se trasladan al lunes |

> Deben validarse con contabilidad/legal antes de producción (p. ej. ISR del décimo, gastos de representación, prima de antigüedad).

## 4. Biometría (Face ID / Touch ID) en web
Se usa **WebAuthn** con autenticador de plataforma como **candado local**: protege la reanudación de sesión y la apertura de comprobantes. En v1 la aserción no se verifica en el servidor; el paso natural es **passkeys completas** (registro y verificación server-side) — ver roadmap.

## 5. Sesión
Access token corto en memoria + refresh token rotativo en `localStorage` para que la sesión sobreviva recargas. Trade-off aceptado para una app de autoservicio; con dominio propio se puede migrar a cookie `HttpOnly` + `SameSite=Strict` sin cambiar la API de negocio.

## 6. Cambios a datos restringidos
El colaborador **solicita** cambios de salario, cargo, banco, etc. RRHH aprueba la solicitud y aplica el valor desde la ficha del colaborador, de modo que todo cambio de salario/banco pasa por el mismo camino auditado.

## 7. Planillas en dos pasos
Generar → **borrador** (invisible para colaboradores) → revisar → **publicar** (notifica a cada colaborador). Evita publicar errores.

## 8. Documentos y PDF
Archivos en una tabla separada (`DocumentFile`) para que listar nunca cargue blobs; fácil migrar a S3/Azure Blob detrás de la misma interfaz. Los comprobantes se generan en PDF bajo demanda con un generador propio (sin licencias de terceros). En el cliente se renderizan con pdf.js porque los iframes no muestran PDFs de forma fiable en móviles.

## 9. Base de datos
PostgreSQL con migraciones EF Core. Para desarrollo sin Docker existe el proveedor SQLite (`--launch-profile sqlite`), creado con `EnsureCreated`. Agregados y ordenamientos sobre `decimal` se hacen en memoria para mantener compatibilidad con ambos.
