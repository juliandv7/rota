import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { jsonResponse, mockApi, renderApp } from '../test/renderApp'
import type { Producto } from '../types/domain'

const scannerMock = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  emit: undefined as ((codigo: string) => void) | undefined,
  devices: [] as { deviceId: string; label: string }[],
}))

vi.mock('../scanner/barcodeScanner', () => ({
  startBarcodeScanner: scannerMock.start,
  listCameraDevices: () => Promise.resolve(scannerMock.devices),
}))

const producto: Producto = {
  id: 1,
  codigoBarra: '7790001000011',
  nombre: 'Leche Entera 1L',
  precioVenta: 1200,
  categoriaId: 1,
  categoriaNombre: 'Lácteos',
  diasUmbralCriticoCategoria: 3,
}

function scannerDisponible() {
  scannerMock.start.mockImplementation((_video, onCode: (codigo: string) => void) => {
    scannerMock.emit = onCode
    return Promise.resolve({ stop: scannerMock.stop })
  })
}

async function abrirScanner() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Escanear código' }))
  expect(screen.getByRole('dialog', { name: 'Escanear código' })).toBeInTheDocument()
  await waitFor(() => expect(scannerMock.start).toHaveBeenCalledOnce())
  return user
}

beforeEach(() => {
  scannerMock.start.mockReset()
  scannerMock.stop.mockReset()
  scannerMock.emit = undefined
  scannerMock.devices = []
  scannerDisponible()
})

afterEach(() => vi.unstubAllGlobals())

describe('Escaneo con cámara en Recepción', () => {
  it('abre y cierra el escáner liberando la cámara', async () => {
    renderApp('/recepcion', 'ROLE_REPOSITOR')
    const user = await abrirScanner()

    await user.click(screen.getByRole('button', { name: 'Cerrar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(scannerMock.stop).toHaveBeenCalledOnce()
  })

  it('lee un código y muestra automáticamente el producto con la medición', async () => {
    const fetchMock = mockApi({
      'GET /api/productos/codigo/7790001000011': () => jsonResponse(producto),
    })
    renderApp('/recepcion', 'ROLE_REPOSITOR')
    await abrirScanner()

    act(() => scannerMock.emit?.('7790001000011'))

    expect(await screen.findByText('Leche Entera 1L')).toBeInTheDocument()
    expect(await screen.findByText(/Medición local: lectura/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('respeta los permisos cuando el código escaneado no existe', async () => {
    mockApi({
      'GET /api/productos/codigo/999': () => jsonResponse({ status: 404, message: 'Producto no encontrado' }, 404),
    })
    renderApp('/recepcion', 'ROLE_REPOSITOR')
    await abrirScanner()

    act(() => scannerMock.emit?.('999'))

    expect(await screen.findByText(/Solo el dueño puede dar de alta productos nuevos/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crear producto' })).not.toBeInTheDocument()
  })

  it('explica cómo continuar cuando el permiso de cámara fue denegado', async () => {
    scannerMock.start.mockRejectedValue(new DOMException('denegado', 'NotAllowedError'))
    renderApp('/recepcion', 'ROLE_REPOSITOR')
    await abrirScanner()

    expect(await screen.findByText(/Habilitá el permiso en el navegador/)).toBeInTheDocument()
    expect(screen.getByText(/ingresá el código manualmente/)).toBeInTheDocument()
  })

  it('ofrece el ingreso manual cuando no hay cámara disponible', async () => {
    scannerMock.start.mockRejectedValue(new DOMException('sin cámara', 'NotFoundError'))
    renderApp('/recepcion', 'ROLE_REPOSITOR')
    const user = await abrirScanner()

    expect(await screen.findByText(/No encontramos una cámara disponible/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(screen.getByLabelText('Código de barras')).toBeInTheDocument()
  })

  it('ignora lecturas duplicadas del mismo ciclo de cámara', async () => {
    const fetchMock = mockApi({
      'GET /api/productos/codigo/7790001000011': () => jsonResponse(producto),
    })
    renderApp('/recepcion', 'ROLE_REPOSITOR')
    await abrirScanner()

    act(() => {
      scannerMock.emit?.('7790001000011')
      scannerMock.emit?.('7790001000011')
    })

    await screen.findByText('Leche Entera 1L')
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('libera los recursos al salir de la pantalla', async () => {
    const app = renderApp('/recepcion', 'ROLE_REPOSITOR')
    await abrirScanner()

    app.unmount()

    expect(scannerMock.stop).toHaveBeenCalledOnce()
  })

  it('mantiene la búsqueda manual como alternativa a la cámara', async () => {
    const fetchMock = mockApi({
      'GET /api/productos/codigo/7790001000011': () => jsonResponse(producto),
    })
    const user = userEvent.setup()
    renderApp('/recepcion', 'ROLE_REPOSITOR')

    await user.type(screen.getByLabelText('Código de barras'), '7790001000011')
    await user.click(screen.getByRole('button', { name: 'Buscar producto' }))

    expect(await screen.findByText('Leche Entera 1L')).toBeInTheDocument()
    expect(scannerMock.start).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
