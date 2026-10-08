import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages 把站点挂在 /pocket/app/ 下,资源路径要跟着走。
  // usePose.ts 用 import.meta.env.BASE_URL 拼 wasm 和模型路径,所以这里改了就够。
  base: process.env.DEPLOY_BASE ?? '/',
  plugins: [react()],
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
})
