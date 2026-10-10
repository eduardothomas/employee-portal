import { useEffect, useRef, useState } from 'react'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { errorMessage, saveBlob } from '@ep/shared'
import { api } from '../lib/api'
import { biometric, biometricLabel } from '../lib/biometric'
import { toast } from './ui'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

interface Props {
  path: string
  fileName: string
  title: string
  onClose(): void
  /** Require Face ID/Touch ID before showing (when the user enabled it). */
  protect?: boolean
}

/** Full-screen document viewer with share/save. Fetches with auth and renders in-app. */
export function PdfViewer({ path, fileName, title, onClose, protect }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (protect && biometric.isEnrolled() && !(await biometric.verify())) {
        if (!cancelled) setError(`Verificación con ${biometricLabel()} cancelada.`)
        return
      }
      try {
        const b = await api.blob(path)
        if (!cancelled) setBlob(b)
      } catch (e) {
        if (!cancelled) setError(errorMessage(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path, protect])

  async function share() {
    if (!blob) return
    const file = new File([blob], fileName, { type: blob.type })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title })
      } catch {
        /* user cancelled */
      }
    } else {
      saveBlob(blob, fileName)
      toast('Tu navegador no permite compartir; se descargó el archivo.')
    }
  }

  let body
  if (error) body = <div className="empty"><span className="emoji">🔒</span>{error}</div>
  else if (!blob) body = <div className="spinner" />
  else if (blob.type.startsWith('image/')) body = <ImagePreview blob={blob} />
  else if (blob.type === 'application/pdf') body = <PdfPages blob={blob} />
  else body = <div className="empty"><span className="emoji">📄</span>Vista previa no disponible. Usa “Guardar”.</div>

  return (
    <div className="viewer" role="dialog" aria-label={title}>
      <div className="viewer-bar">
        <button className="btn plain small" onClick={onClose}>Cerrar</button>
        <strong>{title}</strong>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn plain small" disabled={!blob} onClick={share}>Compartir</button>
          <button className="btn plain small" disabled={!blob} onClick={() => blob && saveBlob(blob, fileName)}>Guardar</button>
        </div>
      </div>
      {body}
    </div>
  )
}

/** Renders every page into a canvas — iframes don't display PDFs reliably on mobile browsers. */
function PdfPages({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    const container = ref.current!
    container.replaceChildren()
    ;(async () => {
      try {
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
        const ratio = window.devicePixelRatio || 1
        for (let n = 1; n <= doc.numPages && !cancelled; n++) {
          const page = await doc.getPage(n)
          const fit = (container.clientWidth - 24) / page.getViewport({ scale: 1 }).width
          const viewport = page.getViewport({ scale: fit * ratio })
          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.width = `${viewport.width / ratio}px`
          container.appendChild(canvas)
          await page.render({ canvas, viewport }).promise
        }
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [blob])

  if (failed) return <div className="empty"><span className="emoji">📄</span>No se pudo mostrar el documento. Usa “Guardar”.</div>
  return <div ref={ref} className="pdf-pages" />
}

function ImagePreview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return <div className="pdf-pages">{url && <img src={url} alt="" style={{ maxWidth: '100%' }} />}</div>
}
