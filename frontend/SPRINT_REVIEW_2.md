# Sprint Review 2

## Puesta en marcha

Requisitos: Docker, JDK 17, Maven 3.9, Node.js 20 o superior y npm. El wrapper Maven incluido en esta versión no contiene `.mvn/wrapper`, por lo que hay que usar una instalación local de Maven.

Terminal 1, desde la raíz del repositorio:

```bash
docker compose up -d
docker compose ps
```

Esperá a que `rota-db` figure en ejecución. No uses `docker compose down -v` antes de la demo porque elimina el volumen de datos.

Terminal 2:

```bash
cd backend
mvn spring-boot:run
```

La API queda en `http://localhost:8080`. El mismo comando funciona desde PowerShell si `mvn` está en `PATH`.

Terminal 3:

```bash
cd frontend
npm install
npm run dev
```

Abrí `http://localhost:5173` en la computadora. El proxy de Vite conecta `/api` con Spring Boot.

## Usuarios de demostración

| Rol | Email | Contraseña |
| --- | --- | --- |
| Dueño | `dueno@comercio.com` | `123456` |
| Repositor | `repositor@comercio.com` | `123456` |

Si la base ya tenía datos, `DataInitializer` conserva esos registros. Para garantizar las credenciales semilla hace falta una base inicialmente vacía.

## Recorrido sugerido

1. Iniciá sesión como dueño y abrí Ruta del día. Mostrá los indicadores y el valor en riesgo.
2. Cerrá sesión e ingresá como repositor. En Ruta del día comprobá que no aparece el valor económico.
3. Abrí Recepción y elegí Escanear código. Para un producto semilla podés mostrar un código Code 128 con el texto `7790001000011` en otra pantalla.
4. Mostrá que el producto aparece automáticamente y señalá la medición local. Completá vencimiento, cantidad y ubicación.
5. Probá un código no registrado. El repositor recibe la indicación de avisarle al dueño. El dueño sí obtiene el formulario de alta con los campos económicos.
6. Denegá el permiso de cámara o cerrá el escáner y mostrá que el ingreso manual sigue disponible.
7. Abrí Reponer. Elegí un producto con stock en depósito y mostrá el orden FEFO y la recomendación del lote que vence primero.
8. Abrí Consulta y buscá por nombre o código. Mostrá stock y lotes ordenados.
9. Como repositor intentá acceder a `/configuracion`. La aplicación debe mostrar que no tiene acceso.

## Cámara desde iPhone

Safari exige HTTPS para `getUserMedia` cuando no se usa `localhost`. Seguí la configuración con `mkcert` de [README.md](./README.md). La URL final será `https://<IP-local>:5173`; Spring Boot puede seguir en `http://localhost:8080` porque el navegador sólo se comunica con el proxy HTTPS de Vite.

Antes de la Review verificá que:

- El iPhone y la computadora estén en la misma red.
- El certificado incluya exactamente la IP usada en la URL.
- La CA raíz de `mkcert` esté instalada y marcada como confiable en el iPhone.
- Safari tenga permiso de cámara para el sitio.
- Ninguna otra aplicación esté ocupando la cámara.

## Medición de HU-27

Después de un escaneo exitoso, Recepción muestra:

- `lectura`: desde que comienza la apertura del lector hasta que ZXing entrega el primer código válido.
- `desde el reconocimiento hasta mostrar el producto`: desde ese resultado hasta que React renderiza el producto obtenido de la API.

La segunda medición incluye la consulta HTTP. Sirve para comparar repeticiones de manera reproducible, pero no demuestra por sí sola el criterio de menos de dos segundos. Ese criterio requiere repetir la prueba en un celular real, registrar modelo, navegador, red y al menos diez mediciones.

## Dependencias de backend

### HU-16

El backend debe definir una operación autenticada para marcar una revisión y persistir lote, usuario autenticado y fecha y hora del servidor. También debe definir la idempotencia por día y hacer que Ruta del día excluya las revisiones vigentes. El frontend agregará la acción en cada tarjeta, su estado de carga, confirmación, error y recarga de la lista cuando exista el contrato real.

### HU-20

El backend debe registrar una venta en una transacción, recibir producto y unidades, validar el stock total, asignar el descuento por FEFO y devolver los lotes afectados. También debe persistir el historial diario y definir la respuesta de velocidad de venta. El frontend podrá agregar el formulario, la confirmación de la asignación y las vistas de historial y velocidad cuando esos contratos estén acordados.

No existen endpoints para estas dos historias en la versión actual y el frontend no simula su persistencia.
