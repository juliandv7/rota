/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8080'
  const https = env.VITE_HTTPS_KEY_PATH && env.VITE_HTTPS_CERT_PATH
    ? {
        key: readFileSync(env.VITE_HTTPS_KEY_PATH),
        cert: readFileSync(env.VITE_HTTPS_CERT_PATH),
      }
    : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: true,
      port: 5173,
      https,
      allowedHosts: ['.trycloudflare.com'],
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
      },
    },
    preview: {
      proxy: {
        '/api': { target: backendUrl, changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  }
})
