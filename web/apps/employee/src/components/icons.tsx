import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' } as const

export const HomeIcon = (p: P) => (
  <svg {...base} {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>
)
export const WalletIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2" /><path d="M6 6V5a2 2 0 0 1 2-2h8" /></svg>
)
export const CalendarIcon = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
)
export const PersonIcon = (p: P) => (
  <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" /></svg>
)
export const BellIcon = (p: P) => (
  <svg {...base} {...p} width={22} height={22}><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9M10 19a2 2 0 0 0 4 0" /></svg>
)
export const ChevronRight = (p: P) => (
  <svg viewBox="0 0 8 14" className="chevron" {...p}><path d="m1 1 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const ChevronLeft = (p: P) => (
  <svg viewBox="0 0 12 20" width="12" height="20" {...p}><path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
export const EyeIcon = ({ off, ...p }: P & { off?: boolean }) => (
  <svg {...base} {...p} width={20} height={20}>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
)
export const FaceIdIcon = (p: P) => (
  <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" {...p}>
    <path d="M4 18V10a6 6 0 0 1 6-6h8M46 4h8a6 6 0 0 1 6 6v8M60 46v8a6 6 0 0 1-6 6h-8M18 60h-8a6 6 0 0 1-6-6v-8" />
    <path d="M22 24v5M42 24v5M32 24v13h-3M24 44c4.5 4 11.5 4 16 0" />
  </svg>
)
