import { BrowserMultiFormatReader } from '@zxing/browser'

export interface BarcodeScannerSession {
  stop: () => void
}

export interface CameraDevice {
  deviceId: string
  label: string
}

export async function listCameraDevices(): Promise<CameraDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((device) => device.kind === 'videoinput')
    .map((device, index) => ({
      deviceId: device.deviceId,
      label: device.label || `Cámara ${index + 1}`,
    }))
}

function stopVideo(video: HTMLVideoElement) {
  const stream = video.srcObject
  if (stream instanceof MediaStream) {
    stream.getTracks().forEach((track) => track.stop())
  }
  video.srcObject = null
}

export async function startBarcodeScanner(
  video: HTMLVideoElement,
  onCode: (codigo: string) => void,
  deviceId?: string,
): Promise<BarcodeScannerSession> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new DOMException('No hay una cámara disponible.', 'NotFoundError')
  }

  const reader = new BrowserMultiFormatReader(undefined, {
    delayBetweenScanAttempts: 100,
    delayBetweenScanSuccess: 500,
  })

  try {
    const controls = await reader.decodeFromConstraints(
      {
        audio: false,
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
      },
      video,
      (result) => {
        const codigo = result?.getText().trim()
        if (codigo) onCode(codigo)
      },
    )

    let stopped = false
    return {
      stop() {
        if (stopped) return
        stopped = true
        controls.stop()
        stopVideo(video)
        BrowserMultiFormatReader.releaseAllStreams()
      },
    }
  } catch (error) {
    stopVideo(video)
    BrowserMultiFormatReader.releaseAllStreams()
    throw error
  }
}
