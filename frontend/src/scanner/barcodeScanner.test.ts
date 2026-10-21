import { describe, expect, it } from 'vitest'
import { chooseBestCamera, type CameraDevice } from './barcodeScanner'

const camera = (deviceId: string, label: string): CameraDevice => ({ deviceId, label })

describe('selección automática de cámara', () => {
  it('prefiere la cámara trasera principal', () => {
    const devices = [
      camera('front', 'Front Camera'),
      camera('ultra', 'Back Ultra Wide Camera'),
      camera('main', 'Back Camera'),
    ]

    expect(chooseBestCamera(devices)?.deviceId).toBe('main')
  })

  it('reconoce etiquetas de cámara trasera en español y Android', () => {
    const devices = [
      camera('selfie', 'Cámara frontal'),
      camera('back', 'camera2 0, facing back'),
      camera('macro', 'Back Macro Camera'),
    ]

    expect(chooseBestCamera(devices)?.deviceId).toBe('back')
  })

  it('deja que facingMode decida cuando las etiquetas no identifican la orientación', () => {
    expect(chooseBestCamera([camera('one', 'Cámara 1'), camera('two', 'Cámara 2')])).toBeUndefined()
  })
})
