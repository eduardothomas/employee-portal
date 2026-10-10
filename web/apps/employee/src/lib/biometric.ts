/**
 * Face ID / Touch ID / Windows Hello via WebAuthn platform authenticators.
 *
 * v1 scope: a *local* unlock gate. The OS verifies the user's biometrics before we resume the
 * stored session or open a protected PDF. The assertion is not yet verified server-side —
 * that (full passkey login) is on the v2 roadmap.
 */
const KEY = 'ep.employee.biometric'

interface Enrollment {
  credentialId: string
  userId: string
}

function read(): Enrollment | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Enrollment) : null
  } catch {
    return null
  }
}

const toB64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const challenge = () => crypto.getRandomValues(new Uint8Array(32))

export const biometric = {
  async isAvailable(): Promise<boolean> {
    try {
      return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
    } catch {
      return false
    }
  },

  isEnrolled(userId?: string): boolean {
    const e = read()
    return !!e && (!userId || e.userId === userId)
  },

  async enroll(user: { id: string; employeeCode: string; fullName: string }): Promise<void> {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge: challenge(),
        rp: { name: 'Employee Portal' },
        user: { id: new TextEncoder().encode(user.id), name: user.employeeCode, displayName: user.fullName },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null
    if (!cred) throw new Error('No se pudo activar.')
    localStorage.setItem(KEY, JSON.stringify({ credentialId: toB64(cred.rawId), userId: user.id }))
  },

  async verify(): Promise<boolean> {
    const e = read()
    if (!e) return false
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: challenge(),
          allowCredentials: [{ type: 'public-key', id: fromB64(e.credentialId) }],
          userVerification: 'required',
          timeout: 60_000,
        },
      })
      return !!assertion
    } catch {
      return false
    }
  },

  disable() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  },
}

/** Name shown in the UI depending on the platform. */
export function biometricLabel(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad/.test(ua)) return 'Face ID'
  if (/Macintosh/.test(ua)) return 'Touch ID'
  if (/Windows/.test(ua)) return 'Windows Hello'
  return 'biometría'
}
