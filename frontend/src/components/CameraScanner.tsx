import { useEffect, useRef, useState } from 'react'
import type { BarcodeScannerSession, CameraDevice } from '../scanner/barcodeScanner'
import { Button } from './Button'
import { InlineAlert } from './States'

export interface ScanResult {
  codigo: string
  decodeMs: number
  recognizedAt: number
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'No pudimos acceder a la cámara. Habilitá el permiso en el navegador o ingresá el código manualmente.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'NotReadableError') {
    return 'No encontramos una cámara disponible. Podés ingresar el código manualmente.'
  }
  return 'No pudimos iniciar la cámara. Cerrá el escáner e ingresá el código manualmente.'
}

export function CameraScanner({ onDetected, onClose }: { onDetected: (result: ScanResult) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const sessionRef = useRef<BarcodeScannerSession | null>(null)
  const detectedRef = useRef(false)
  const [state, setState] = useState<'opening' | 'scanning' | 'blank' | 'error'>('opening')
  const [error, setError] = useState<string | null>(null)
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>()
  const [activeDeviceId, setActiveDeviceId] = useState<string | undefined>()

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let disposed = false
    let blankTimer: number | undefined
    const startedAt = performance.now()
    setState('opening')
    setError(null)

    import('../scanner/barcodeScanner')
      .then(async ({ chooseBestCamera, listCameraDevices, startBarcodeScanner }) => {
        const devicesBeforePermission = await listCameraDevices().catch(() => [])
        const requestedDeviceId = selectedDeviceId ?? chooseBestCamera(devicesBeforePermission)?.deviceId
        const session = await startBarcodeScanner(video, (codigo) => {
          if (disposed || detectedRef.current) return
          detectedRef.current = true
          const recognizedAt = performance.now()
          sessionRef.current?.stop()
          onDetected({ codigo, decodeMs: recognizedAt - startedAt, recognizedAt })
        }, requestedDeviceId)
        const availableDevices = await listCameraDevices().catch(() => [])
        return { availableDevices, preferredDevice: chooseBestCamera(availableDevices), requestedDeviceId, session }
      })
      .then(({ availableDevices, preferredDevice, requestedDeviceId, session }) => {
        if (disposed || detectedRef.current) session.stop()
        else {
          const stream = video.srcObject
          const activeTrack = typeof MediaStream !== 'undefined' && stream instanceof MediaStream ? stream.getVideoTracks()[0] : undefined
          const activeId = activeTrack?.getSettings().deviceId ?? requestedDeviceId
          if (!selectedDeviceId && preferredDevice && preferredDevice.deviceId !== activeId) {
            session.stop()
            setSelectedDeviceId(preferredDevice.deviceId)
            return
          }
          sessionRef.current = session
          setDevices(availableDevices)
          setActiveDeviceId(activeId)
          setState('scanning')
          blankTimer = window.setTimeout(() => {
            if (!disposed && video.videoWidth === 0) setState('blank')
          }, 2000)
        }
      })
      .catch((cause: unknown) => {
        if (disposed) return
        setError(cameraErrorMessage(cause))
        setState('error')
      })

    return () => {
      disposed = true
      if (blankTimer !== undefined) window.clearTimeout(blankTimer)
      sessionRef.current?.stop()
      sessionRef.current = null
    }
  }, [onDetected, selectedDeviceId])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scanner-title"
      className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <div className="flex items-center justify-between gap-3 px-4 pb-4">
        <div>
          <h2 id="scanner-title" className="text-xl font-bold">Escanear código</h2>
          <p className="text-sm text-slate-300">Apuntá la cámara al código de barras.</p>
        </div>
        <Button variant="secondary" className="min-h-11 shrink-0 bg-white text-slate-950" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video ref={videoRef} muted playsInline autoPlay className="h-full w-full object-cover" aria-label="Vista previa de la cámara" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-32 w-[min(82vw,30rem)] rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(0,0,0,0.38)]" />
        </div>
      </div>

      <div className="px-4 pt-4 text-center" aria-live="polite">
        {state === 'opening' && <p className="font-semibold">Abriendo la cámara...</p>}
        {state === 'scanning' && <p className="font-semibold">Buscando un código...</p>}
        {state === 'blank' && (
          <InlineAlert kind="error">La cámara dio permiso pero no envía imagen. Elegí otra cámara o cerrá y volvé a intentar.</InlineAlert>
        )}
        {state === 'error' && error && <InlineAlert kind="error">{error}</InlineAlert>}
        {devices.length > 1 && (
          <label className="mx-auto mt-3 flex max-w-md items-center gap-3 text-left font-semibold">
            <span className="shrink-0">Cámara</span>
            <select
              aria-label="Cámara"
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-500 bg-white px-3 text-slate-950"
              value={activeDeviceId ?? selectedDeviceId ?? ''}
              onChange={(event) => {
                detectedRef.current = false
                setSelectedDeviceId(event.target.value)
              }}
            >
              {devices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
              ))}
            </select>
          </label>
        )}
        <p className="mt-2 text-sm text-slate-300">No se guardan imágenes ni videos.</p>
      </div>
    </div>
  )
}
