import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { crearProducto, getCategorias, getProductoPorCodigo, registrarLote } from '../api/endpoints'
import { useAuth } from '../auth/AuthContext'
import { Button } from '../components/Button'
import { CameraScanner, type ScanResult } from '../components/CameraScanner'
import { PageHeader } from '../components/PageHeader'
import { Segmented } from '../components/Segmented'
import { SelectField } from '../components/SelectField'
import { InlineAlert } from '../components/States'
import { TextField } from '../components/TextField'
import { UBICACION_LABEL, formatDate, formatUnits, todayIso } from '../format'
import { errorMessage } from '../hooks/useApi'
import type { Categoria, Lote, Producto, Ubicacion } from '../types/domain'

type Paso = 'codigo' | 'nuevo' | 'lote' | 'listo'
type Errores = Record<string, string>
type Identificacion = { decodeMs: number; recognizedAt: number; visibleMs?: number }

const UBICACIONES_RECEPCION: { value: Ubicacion; label: string }[] = [
  { value: 'DEPOSITO', label: UBICACION_LABEL.DEPOSITO },
  { value: 'GONDOLA', label: UBICACION_LABEL.GONDOLA },
]

function ProductoResumen({ producto, onCambiar }: { producto: Producto; onCambiar: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="min-w-0">
        <p className="font-heading text-lg font-semibold leading-snug [overflow-wrap:anywhere]">{producto.nombre}</p>
        <p className="text-sm text-muted-foreground">
          {producto.categoriaNombre} · {producto.codigoBarra}
        </p>
      </div>
      <Button variant="ghost" className="shrink-0 px-3" onClick={onCambiar}>
        Cambiar
      </Button>
    </div>
  )
}

function PasoCodigo({
  onEncontrado,
  onNoExiste,
}: {
  onEncontrado: (p: Producto, identificacion?: Identificacion) => void
  onNoExiste: (codigo: string) => void
}) {
  const [codigo, setCodigo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [])

  const buscarCodigo = useCallback(async (limpio: string, scan?: ScanResult) => {
    if (!limpio) {
      setError('Ingresá el código de barras.')
      return
    }
    setError(null)
    setBuscando(true)
    try {
      onEncontrado(
        await getProductoPorCodigo(limpio),
        scan ? { decodeMs: scan.decodeMs, recognizedAt: scan.recognizedAt } : undefined,
      )
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) onNoExiste(limpio)
      else setError(errorMessage(err))
      setBuscando(false)
    }
  }, [onEncontrado, onNoExiste])

  async function buscar(e: FormEvent) {
    e.preventDefault()
    await buscarCodigo(codigo.trim())
  }

  const handleDetected = useCallback((scan: ScanResult) => {
    setScannerOpen(false)
    setCodigo(scan.codigo)
    void buscarCodigo(scan.codigo, scan)
  }, [buscarCodigo])

  return (
    <form noValidate onSubmit={buscar} className="space-y-4">
      <TextField
        ref={inputRef}
        label="Código de barras"
        name="codigo"
        inputMode="numeric"
        autoComplete="off"
        enterKeyHint="search"
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        error={error ?? undefined}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="button" fullWidth variant="secondary" disabled={buscando} onClick={() => setScannerOpen(true)}>
          Escanear código
        </Button>
        <Button type="submit" fullWidth loading={buscando}>
          {buscando ? 'Buscando' : 'Buscar producto'}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">También podés escribir el código si no querés usar la cámara.</p>
      {scannerOpen && <CameraScanner onDetected={handleDetected} onClose={() => setScannerOpen(false)} />}
    </form>
  )
}

function PasoProductoNuevo({
  codigo,
  esDueno,
  onCreado,
  onVolver,
}: {
  codigo: string
  esDueno: boolean
  onCreado: (p: Producto) => void
  onVolver: () => void
}) {
  const [categorias, setCategorias] = useState<Categoria[] | null>(null)
  const [cargaError, setCargaError] = useState<string | null>(null)
  const [form, setForm] = useState({ nombre: '', precioVenta: '', costo: '', categoriaId: '' })
  const [errores, setErrores] = useState<Errores>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!esDueno) return
    const controller = new AbortController()
    getCategorias(controller.signal)
      .then((cs) => setCategorias(cs.filter((c) => c.activa)))
      .catch((err) => !controller.signal.aborted && setCargaError(errorMessage(err)))
    return () => controller.abort()
  }, [esDueno])

  if (!esDueno) {
    return (
      <div className="space-y-4">
        <InlineAlert kind="info">
          El código {codigo} no está cargado. Solo el dueño puede dar de alta productos nuevos: avisale para que lo cargue.
        </InlineAlert>
        <Button fullWidth variant="secondary" onClick={onVolver}>
          Probar otro código
        </Button>
      </div>
    )
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const errs: Errores = {}
    if (!form.nombre.trim()) errs.nombre = 'Ingresá el nombre.'
    if (!(Number(form.precioVenta) > 0)) errs.precioVenta = 'Ingresá un precio mayor a 0.'
    if (form.costo === '' || Number(form.costo) < 0) errs.costo = 'Ingresá el costo.'
    if (!form.categoriaId) errs.categoriaId = 'Elegí una categoría.'
    setErrores(errs)
    setFormError(null)
    if (Object.keys(errs).length) return
    setGuardando(true)
    try {
      onCreado(
        await crearProducto({
          codigoBarra: codigo,
          nombre: form.nombre.trim(),
          precioVenta: Number(form.precioVenta),
          costo: Number(form.costo),
          categoriaId: Number(form.categoriaId),
        }),
      )
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors)
      setFormError(errorMessage(err))
      setGuardando(false)
    }
  }

  return (
    <form noValidate onSubmit={guardar} className="space-y-4">
      <InlineAlert kind="info">El código {codigo} no está cargado. Completá los datos para crear el producto.</InlineAlert>
      {formError && <InlineAlert kind="error">{formError}</InlineAlert>}
      {cargaError && <InlineAlert kind="error">No pudimos cargar las categorías. {cargaError}</InlineAlert>}
      <TextField label="Nombre del producto" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} error={errores.nombre} />
      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="Precio de venta"
          inputMode="decimal"
          value={form.precioVenta}
          onChange={(e) => setForm({ ...form, precioVenta: e.target.value.replace(',', '.') })}
          error={errores.precioVenta}
        />
        <TextField
          label="Costo"
          inputMode="decimal"
          value={form.costo}
          onChange={(e) => setForm({ ...form, costo: e.target.value.replace(',', '.') })}
          error={errores.costo}
        />
      </div>
      <SelectField
        label="Categoría"
        value={form.categoriaId}
        onChange={(e) => setForm({ ...form, categoriaId: e.target.value })}
        error={errores.categoriaId}
        disabled={!categorias}
      >
        <option value="">{categorias ? 'Elegí una categoría' : 'Cargando categorías'}</option>
        {categorias?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="submit" loading={guardando}>
          {guardando ? 'Creando' : 'Crear producto'}
        </Button>
        <Button variant="secondary" onClick={onVolver}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

function PasoLote({ producto, onRegistrado, onCambiar }: { producto: Producto; onRegistrado: (l: Lote) => void; onCambiar: () => void }) {
  const [fecha, setFecha] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [ubicacion, setUbicacion] = useState<Ubicacion>('DEPOSITO')
  const [errores, setErrores] = useState<Errores>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const fechaRef = useRef<HTMLInputElement>(null)

  useEffect(() => fechaRef.current?.focus(), [])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    const errs: Errores = {}
    if (!fecha) errs.fechaVencimiento = 'Elegí la fecha de vencimiento.'
    else if (fecha < todayIso()) errs.fechaVencimiento = 'No se pueden cargar productos vencidos.'
    const n = Number(cantidad)
    if (!Number.isInteger(n) || n < 1) errs.cantidad = 'Ingresá una cantidad de al menos 1.'
    setErrores(errs)
    setFormError(null)
    if (Object.keys(errs).length) return
    setGuardando(true)
    try {
      onRegistrado(await registrarLote({ productoId: producto.id, cantidad: n, fechaVencimiento: fecha, ubicacion }))
    } catch (err) {
      if (err instanceof ApiError) setErrores(err.fieldErrors)
      setFormError(errorMessage(err))
      setGuardando(false)
    }
  }

  return (
    <form noValidate onSubmit={guardar} className="space-y-4">
      <ProductoResumen producto={producto} onCambiar={onCambiar} />
      {formError && <InlineAlert kind="error">{formError}</InlineAlert>}
      <div className="grid grid-cols-2 gap-3">
        <TextField
          ref={fechaRef}
          label="Vence el"
          type="date"
          min={todayIso()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          error={errores.fechaVencimiento}
        />
        <TextField
          label="Cantidad"
          inputMode="numeric"
          enterKeyHint="done"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value.replace(/\D/g, ''))}
          error={errores.cantidad}
        />
      </div>
      <Segmented label="Ubicación" options={UBICACIONES_RECEPCION} value={ubicacion} onChange={setUbicacion} />
      <Button type="submit" fullWidth loading={guardando}>
        {guardando ? 'Registrando' : 'Registrar lote'}
      </Button>
    </form>
  )
}

export function RecepcionPage() {
  const { session } = useAuth()
  const esDueno = session?.rol === 'ROLE_DUENO'
  const [paso, setPaso] = useState<Paso>('codigo')
  const [codigo, setCodigo] = useState('')
  const [producto, setProducto] = useState<Producto | null>(null)
  const [lote, setLote] = useState<Lote | null>(null)
  const [productoCreado, setProductoCreado] = useState(false)
  const [identificacion, setIdentificacion] = useState<Identificacion | null>(null)

  useEffect(() => {
    if (paso !== 'lote' || !producto || !identificacion || identificacion.visibleMs != null) return
    const timer = window.setTimeout(() => {
      setIdentificacion({ ...identificacion, visibleMs: performance.now() - identificacion.recognizedAt })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [identificacion, paso, producto])

  function reiniciar() {
    setPaso('codigo')
    setCodigo('')
    setProducto(null)
    setLote(null)
    setProductoCreado(false)
    setIdentificacion(null)
  }

  return (
    <section className="max-w-xl">
      <PageHeader title="Recepción" description="Cargá un lote que llega: código, vencimiento, cantidad y ubicación." />

      {paso === 'codigo' && (
        <PasoCodigo
          onEncontrado={(p, medicion) => {
            setProducto(p)
            setIdentificacion(medicion ?? null)
            setPaso('lote')
          }}
          onNoExiste={(c) => {
            setCodigo(c)
            setPaso('nuevo')
          }}
        />
      )}

      {paso === 'nuevo' && (
        <PasoProductoNuevo
          codigo={codigo}
          esDueno={esDueno}
          onVolver={reiniciar}
          onCreado={(p) => {
            setProducto(p)
            setProductoCreado(true)
            setPaso('lote')
          }}
        />
      )}

      {paso === 'lote' && producto && (
        <div className="space-y-4">
          {productoCreado && <InlineAlert kind="success">Producto creado. Ahora cargá el lote.</InlineAlert>}
          {identificacion?.visibleMs != null && (
            <p role="status" className="text-sm text-muted-foreground">
              Medición local: lectura {Math.round(identificacion.decodeMs)} ms, desde el reconocimiento hasta mostrar el producto {Math.round(identificacion.visibleMs)} ms.
            </p>
          )}
          <PasoLote
            producto={producto}
            onCambiar={reiniciar}
            onRegistrado={(l) => {
              setLote(l)
              setPaso('listo')
            }}
          />
        </div>
      )}

      {paso === 'listo' && lote && (
        <div className="space-y-4">
          <div role="status" className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
            <p className="font-heading text-lg font-bold text-emerald-900">Lote registrado</p>
            <p className="mt-1 font-semibold [overflow-wrap:anywhere]">{lote.productoNombre}</p>
            <p className="text-emerald-900">
              {formatUnits(lote.cantidad)} · vence el {formatDate(lote.fechaVencimiento)} · {UBICACION_LABEL[lote.ubicacion]}
            </p>
          </div>
          <Button fullWidth onClick={reiniciar}>
            Recibir otro lote
          </Button>
        </div>
      )}
    </section>
  )
}
