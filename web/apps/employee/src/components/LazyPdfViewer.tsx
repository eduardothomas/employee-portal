import { Suspense, lazy, type ComponentProps } from 'react'

// pdf.js is large — load it only when a document is opened.
const Viewer = lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })))

export function PdfViewer(props: ComponentProps<typeof Viewer>) {
  return (
    <Suspense fallback={<div className="viewer"><div className="spinner" /></div>}>
      <Viewer {...props} />
    </Suspense>
  )
}
