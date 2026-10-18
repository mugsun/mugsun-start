import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': '/src' } },
  server: { port: 3093, strictPort: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] }
} as never)
