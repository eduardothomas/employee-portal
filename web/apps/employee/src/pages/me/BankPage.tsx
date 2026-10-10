import { useState } from 'react'
import { useResource } from '@ep/shared'
import type { Me } from '@ep/shared'
import { Load, NavBar, Row } from '../../components/ui'
import { ChangeRequestSheet, type ChangeTarget } from './ChangeRequestSheet'

export function BankPage() {
  const res = useResource<Me>('/me')
  const [change, setChange] = useState<ChangeTarget | null>(null)

  return (
    <>
      <NavBar title="Información bancaria" />
      <div className="page">
        <Load res={res}>
          {({ bank }) => (
            <>
              <div className="wallet" style={{ minHeight: 160 }}>
                <span className="wallet-label">{bank.bankName ?? 'Sin banco registrado'}</span>
                <div className="wallet-amount" style={{ fontSize: 26, letterSpacing: '0.12em' }}>{bank.maskedAccount ?? '—'}</div>
                <div className="wallet-meta">{bank.accountType ?? ''}</div>
              </div>
              <div className="spacer" />
              <div className="list">
                <Row title="Banco" value={bank.bankName ?? '—'} />
                <Row title="Tipo de cuenta" value={bank.accountType ?? '—'} />
                <Row title="Número de cuenta" value={bank.maskedAccount ?? '—'} />
              </div>
              <p className="form-note">Por seguridad solo mostramos los últimos 4 dígitos. Los cambios de cuenta requieren validación de RRHH.</p>
              <button className="btn secondary block section" onClick={() => setChange({ field: 'bankAccount', label: 'Cuenta bancaria', current: bank.maskedAccount })}>
                Solicitar cambio de cuenta
              </button>
            </>
          )}
        </Load>
      </div>
      <ChangeRequestSheet target={change} onClose={() => setChange(null)} />
    </>
  )
}
