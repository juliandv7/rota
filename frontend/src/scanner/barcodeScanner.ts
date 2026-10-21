import { BarcodeFormat, BrowserMultiFormatOneDReader } from '@zxing/browser'

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

export function chooseBestCamera(devices: CameraDevice[]): CameraDevice | undefined {
  const scored = devices
    .map((device) => {
      const label = device.label.toLocaleLowerCase()
      let score = 0
      if (/back|rear|environment|traser|traseir|arrière|rück/.test(label)) score += 100
      if (/main|principal|camera 0|cámara 0/.test(label)) score += 20
      if (/wide/.test(label) && !/ultra/.test(label)) score += 5
      if (/front|user|selfie|frontal/.test(label)) score -= 100
      if (/ultra|tele|macro|depth|infra|virtual|obs/.test(label)) score -= 25
      return { device, score }
    })
    .sort((a, b) => b.score - a.score)

  return scored[0] && scored[0].score > 0 ? scored[0].device : undefined
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

  const reader = new BrowserMultiFormatOneDReader(undefined, {
    delayBetweenScanAttempts: 50,
    delayBetweenScanSuccess: 250,
  })
  reader.possibleFormats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
  ]

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
        BrowserMultiFormatOneDReader.releaseAllStreams()
      },
    }
  } catch (error) {
    stopVideo(video)
    BrowserMultiFormatOneDReader.releaseAllStreams()
    throw error
  }
}
