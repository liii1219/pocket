/**
 * setup-assets — 把 MediaPipe 的 wasm 从 node_modules 复制到 public/。
 *
 * 为什么不直接把 wasm 提交进仓库:三个变体加起来 32MB,而 npm install 之后
 * node_modules 里本来就有一模一样的文件。复制一下就好,不用背着它走。
 *
 * 由 package.json 的 postinstall 自动跑,也可以手动 `npm run setup`。
 */

import { cp, mkdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
const dest = join(root, 'public', 'mediapipe', 'wasm')

try {
  await access(src)
} catch {
  console.warn('[setup-assets] 找不到 @mediapipe/tasks-vision,跳过。先跑 npm install。')
  process.exit(0)
}

await mkdir(dest, { recursive: true })
await cp(src, dest, { recursive: true })
console.log('[setup-assets] wasm 已复制到 public/mediapipe/wasm')

// 模型文件不在 npm 包里,只能下载。已经有就不重下。
const model = join(root, 'public', 'models', 'pose_landmarker_lite.task')
try {
  await access(model)
} catch {
  console.warn(
    '[setup-assets] 缺少姿态模型。下载:\n' +
      '  curl -L -o public/models/pose_landmarker_lite.task \\\n' +
      '    https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  )
}
