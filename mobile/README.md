# Employee Portal — App móvil (iOS + Android)

App del colaborador construida con **Kotlin Multiplatform + Compose Multiplatform**. La UI, la lógica, la red y los modelos se escriben una sola vez en Kotlin (`shared/`) y se ejecutan de forma nativa en iOS y Android. Las piezas que dependen de la plataforma (biometría, visor PDF, compartir, almacenamiento) se implementan con `expect`/`actual`.

| | Versión |
|---|---|
| Kotlin | 2.4.21 |
| Compose Multiplatform | 1.12.1 |
| Android Gradle Plugin | 9.4.1 (compileSdk 37, minSdk 26) |
| Gradle | 9.7.1 (wrapper incluido) |
| iOS | 17+ (Xcode 26/27) |
| Red | Ktor 3 + kotlinx.serialization |
| Navegación | Navigation Compose (rutas type-safe) |

## Estructura

```
mobile/
├── shared/                         Módulo KMP: todo el app
│   └── src/
│       ├── commonMain/kotlin/com/employeeportal/
│       │   ├── App.kt              Raíz: sesión, navegación, tab bar
│       │   ├── core/
│       │   │   ├── config/         AppContainer (DI manual) y selección de backend
│       │   │   ├── format/         Moneda, fechas en español
│       │   │   └── platform/       expect: KeyValueStore, BiometricAuthenticator, PdfView, shareFile
│       │   ├── data/
│       │   │   ├── PortalRepository.kt   Contrato de datos
│       │   │   ├── api/            Implementación HTTP (Ktor) contra la API .NET
│       │   │   └── demo/           Backend en memoria con las mismas reglas (planilla Panamá, feriados, PDF)
│       │   ├── domain/             Modelos (espejo de EmployeePortal.Contracts)
│       │   ├── designsystem/       Tema "Apple / Premium", componentes, iconos
│       │   ├── features/           auth, home, payroll, time, profile, notifications, approvals
│       │   └── navigation/         Rutas
│       ├── androidMain/            actual: BiometricPrompt, PdfRenderer, FileProvider, SharedPreferences
│       └── iosMain/                actual: LocalAuthentication (Face ID), PDFKit, UIActivityViewController
├── androidApp/                     App Android (MainActivity, manifest, icono)
└── iosApp/                         Proyecto Xcode (SwiftUI que hospeda la UI de Compose)
```

## Pantallas

- **Login** con selector de servidor, **MFA** de 6 dígitos (con autocompletar del código SMS), oferta de **Face ID / huella** y **desbloqueo biométrico** al reabrir.
- **Inicio**: próximo pago con montos ocultables, vacaciones, accesos rápidos, actividad reciente y aprobaciones si eres manager.
- **Payroll**: salario, último comprobante, historial, desglose mensual, comprobantes por año/mes, **visor PDF nativo** protegido con biometría y botón de compartir, descuentos con gráfico, décimo.
- **Tiempo**: balance, próximas vacaciones, calendario con feriados de Panamá, solicitud con **selector de rango de fechas** y cálculo de días laborables, permisos por día u horas.
- **Yo**: perfil, información personal editable, laboral y bancaria con solicitud de modificación, documentos, seguridad.
- **Notificaciones** y **Aprobaciones** (managers).

## Backend: Demo, API local o Render

En el login, **⚙️ Servidor** permite elegir. La elección se recuerda entre aperturas.

| Opción | URL | Uso |
|---|---|---|
| **Demo** (por defecto) | — | Datos ficticios dentro del app. No necesita servidor. |
| **API local** | Android: `http://10.0.2.2:5080` · iOS: `http://127.0.0.1:5080` | La API .NET corriendo en tu Mac |
| **Render** | `https://employee-portal-api.onrender.com` | La API desplegada |

La URL de producción vive en un solo lugar: `AppConfig.REMOTE_API_URL` en `shared/.../core/config/AppContainer.kt`. Para levantar la API local:

```bash
cd ../backend/src/EmployeePortal.Api && dotnet run --launch-profile sqlite
```

Usuarios demo: `EMP-0001` (empleado) o `laura.mendez@employeeportal.dev` (manager), contraseña `Portal2026!`. En el login, toca el recuadro azul para completar las credenciales. En modo desarrollo el código MFA aparece en pantalla.

## Ejecutar

### Android

Abre la carpeta `mobile/` en **Android Studio** y ejecuta la configuración `androidApp`. Desde la terminal:

```bash
cd mobile
./gradlew :androidApp:installDebug
```

### iOS

```bash
open mobile/iosApp/iosApp.xcodeproj
```

Elige un simulador y presiona ▶︎. La fase *Compile Kotlin Framework* llama a Gradle y compila el módulo `shared` automáticamente. Para un iPhone físico, selecciona tu equipo en *Signing & Capabilities*.

> Si la terminal muestra `xcrun: error: invalid active developer path`, apunta las herramientas a tu Xcode actual:
> `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

## Decisiones

- **Un solo código de UI** con Compose Multiplatform. La app se ve igual en ambas plataformas, con el mismo diseño que la versión web. En iOS se usan servicios nativos: Face ID, PDFKit y la hoja de compartir.
- **`PortalRepository`** separa la UI del origen de datos. El modo demo y la API real son intercambiables en tiempo de ejecución, y la misma interfaz facilita las pruebas.
- **Sesión**: access token en memoria y refresh token rotativo persistido. El refresh es *single-flight*, con un `Mutex`, porque cada refresh token es de un solo uso.
- **Pendiente para producción**:
  - Guardar el refresh token en **Keychain** (iOS) y **EncryptedFile/Keystore** (Android). Hoy usa `NSUserDefaults` y `SharedPreferences`.
  - Push notifications (APNs/FCM con `POST /devices`).
  - Localizar los textos del `DatePicker` (hoy siguen el idioma del dispositivo).
  - Ícono de iOS sin transparencia, que es requisito de la App Store.
