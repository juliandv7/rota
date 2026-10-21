# Rotá · Frontend

App web mobile first para controlar lotes y vencimientos. React 18 + Vite + TypeScript + Tailwind CSS v4, con react-router-dom. Pruebas con Vitest y Testing Library.

El design system está en [DESIGN.md](./DESIGN.md) y el guion para mostrar el MVP en vivo, en [DEMO.md](./DEMO.md).

## Requisitos

- Node.js 20 o superior y npm.
- Docker, JDK 17 y Maven 3.9 (para el backend).

## 1. Levantar el backend

Desde la raíz del repo:

```bash
# Base de datos PostgreSQL 15
docker compose up -d

# API en http://localhost:8080
cd backend
mvn spring-boot:run
```

Con la base vacía, `DataInitializer` carga un comercio, categorías, productos, lotes y los usuarios de prueba.

## 2. Instalar y correr el frontend

```bash
cd frontend
npm install
npm run dev
```

Abrí http://localhost:5173.

El backend no tiene CORS configurado, así que el servidor de Vite reenvía todo lo que empieza con `/api` a `http://localhost:8080`. Si el backend corre en otra dirección, copiá `.env.example` a `.env` y cambiá `VITE_BACKEND_URL`.

### Probar desde el celular

`npm run dev` escucha en toda la red local. Para navegar sin cámara, con el celular en el mismo wifi podés abrir `http://<IP-de-tu-compu>:5173`.

La cámara requiere un contexto seguro. Para un iPhone usá HTTPS con un certificado confiable que incluya la IP local de la computadora:

1. Instalá `mkcert` en la computadora y ejecutá `mkcert -install`.
2. Averiguá la IP local, por ejemplo `192.168.1.25`.
3. Generá el certificado: `mkcert 192.168.1.25 localhost 127.0.0.1`.
4. Copiá `.env.example` a `.env` y completá `VITE_HTTPS_KEY_PATH` y `VITE_HTTPS_CERT_PATH` con las rutas absolutas de los dos archivos generados.
5. Instalá en el iPhone la CA raíz creada por `mkcert` y habilitá su confianza en Configuración, General, Información, Confiar en certificados.
6. Iniciá Vite y abrí `https://192.168.1.25:5173` desde Safari.

Vite sigue enviando `/api` al backend por su proxy, por lo que Spring Boot puede continuar en HTTP y no necesita cambios.

La guía completa para la presentación está en [SPRINT_REVIEW_2.md](./SPRINT_REVIEW_2.md).

## 3. Usuarios de prueba

| Rol | Email | Contraseña | Qué ve |
| --- | --- | --- | --- |
| Dueño | `dueno@comercio.com` | `123456` | Todo el menú, incluida Configuración, y la información económica |
| Encargado (repositor) | `repositor@comercio.com` | `123456` | Ruta del día, Recepción, Reponer y Consulta. Nunca ve costos ni valor en riesgo |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con proxy a la API |
| `npm run build` | Chequeo de tipos y build de producción en `dist/` |
| `npm run preview` | Sirve el build (también con proxy a la API) |
| `npm run lint` | Lint con oxlint |
| `npm run test` | Pruebas con Vitest |
| `npm run test:watch` | Pruebas en modo watch |

## Estructura

```text
src/
  api/          cliente HTTP (fetch + token + manejo de 401) y llamadas por recurso
  auth/         sesión, contexto, guards de rutas por rol
  components/   botones, campos, íconos
  layout/       layout con barra lateral (escritorio) y pestañas inferiores (celular)
  pages/        pantallas
  test/         setup y helpers de pruebas
  navigation.ts menú y permisos por rol
```

## Sesión y permisos

- Al iniciar sesión se guarda el token en `localStorage`. Al cerrar sesión se borra.
- Si cualquier llamada responde 401, la sesión se cierra y se vuelve al login.
- Las rutas del dueño están protegidas: el encargado ve "No tenés acceso" aunque escriba la URL.
