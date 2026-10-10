import { useState } from 'react'
import { formatBytes, formatDate, useResource } from '@ep/shared'
import type { DocumentItem } from '@ep/shared'
import { PdfViewer } from '../../components/LazyPdfViewer'
import { Empty, Load, NavBar, Row, Section } from '../../components/ui'

const GROUPS: { key: DocumentItem['category']; title: string }[] = [
  { key: 'employment', title: 'Laborales' },
  { key: 'payroll', title: 'Payroll' },
  { key: 'other', title: 'Otros' },
]

export function DocumentsPage() {
  const res = useResource<DocumentItem[]>('/me/documents')
  const [open, setOpen] = useState<DocumentItem | null>(null)

  return (
    <>
      <NavBar title="Documentos" />
      <div className="page">
        <h1 className="large-title">Documentos</h1>
        <Load res={res}>
          {(docs) =>
            docs.length === 0 ? (
              <Empty emoji="📂">No tienes documentos</Empty>
            ) : (
              GROUPS.map(({ key, title }) => {
                const items = docs.filter((d) => d.category === key).slice(0, key === 'payroll' ? 6 : undefined)
                if (items.length === 0) return null
                return (
                  <Section key={key} title={title}>
                    <div className="list">
                      {items.map((d) => (
                        <Row key={d.id} icon="📄" title={d.title}
                          subtitle={[formatDate(d.uploadedAt.slice(0, 10)), formatBytes(d.sizeBytes)].filter(Boolean).join(' · ')}
                          onClick={() => setOpen(d)} />
                      ))}
                    </div>
                  </Section>
                )
              })
            )
          }
        </Load>
      </div>
      {open && (
        <PdfViewer path={open.downloadUrl} fileName={open.fileName} title={open.title} protect={open.source === 'payslip'} onClose={() => setOpen(null)} />
      )}
    </>
  )
}
