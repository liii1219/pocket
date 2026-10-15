/**
 * blur — 背景虚化合成【只画,不判断】。
 *
 * 为什么要有:用户测试里"被看见"是贯穿整个流程的门槛。摄像头把这件事放大了一层 ——
 * 工位上开摄像头,拍进去的不只是你,还有你的办公室、同事和白板。
 * 虚化背景让摄像头只保留需要判定的那个人。
 *
 * 🔴 不额外下模型:人像蒙版直接取自已经在跑的 PoseLandmarker
 * (createFromOptions 里 outputSegmentationMasks: true),所以虚化是零新增下载、
 * 零新增推理 —— 只多了一次 canvas 合成。
 *
 * 合成步骤(每帧):
 *   1. 输出画布先画一张高斯模糊的整帧
 *   2. 暂存画布画清晰的整帧,再用蒙版当 alpha 把背景抠掉(destination-in)
 *   3. 把只剩人的暂存画布叠回输出画布
 */

import type { Landmark } from '../lib/pose/angles'

/** 模糊半径。太小看得出是谁,太大像坏掉。12px 在 640×480 上是清楚但认不出的程度。 */
const BLUR_PX = 12

/** 蒙版低于这个概率算背景。留一点余量,避免边缘抖动。 */
const CUTOFF = 0.35

/**
 * 蒙版有没有用。
 * 人在画面里通常占 5%–70%。整帧都是人(>85%)或几乎没有人(<2%)都说明这张蒙版不可信。
 * 抽样算,不逐像素 —— 每帧全扫一遍太贵。
 */
function maskIsUsable(mask: Float32Array): boolean {
  const step = Math.max(1, Math.floor(mask.length / 4000))
  let hit = 0
  let n = 0
  for (let i = 0; i < mask.length; i += step) {
    if (mask[i] > CUTOFF) hit++
    n++
  }
  const frac = hit / n
  return frac > 0.02 && frac < 0.85
}

interface Scratch {
  sharp: HTMLCanvasElement
  mask: HTMLCanvasElement
}

/** 两张暂存画布按尺寸复用,不每帧新建 —— 新建 canvas 很贵。 */
let scratch: Scratch | null = null

function getScratch(w: number, h: number, mw: number, mh: number): Scratch {
  if (
    !scratch ||
    scratch.sharp.width !== w || scratch.sharp.height !== h ||
    scratch.mask.width !== mw || scratch.mask.height !== mh
  ) {
    const sharp = document.createElement('canvas')
    sharp.width = w
    sharp.height = h
    const mask = document.createElement('canvas')
    mask.width = mw
    mask.height = mh
    scratch = { sharp, mask }
  }
  return scratch
}

/**
 * 把一帧画到 canvas 上,背景虚化。
 * @param maskData MediaPipe 分割蒙版,长度 maskW*maskH,每个值是"这里是人"的概率 0..1
 * 没有蒙版时退化成直接画原帧 —— 宁可不虚化,也不能黑屏。
 */
export function drawBlurred(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  maskData: Float32Array | null,
  maskW = 0,
  maskH = 0,
  landmarks: Landmark[] = [],
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas

  // 🔴 蒙版存在但无效时也要兜底。
  // 实测遇到过:按钮开着、骨架在画,画面却一点没糊 —— 因为蒙版整帧都判成"人",
  // "抠出人"等于没抠。只检查 null 发现不了这种情况。
  if (maskData && maskW > 0 && maskH > 0 && !maskIsUsable(maskData)) {
    maskData = null
  }

  // 没有蒙版时的兜底:用关键点围出人所在的区域。
  // 分割蒙版在某些设备/委托组合下拿不到(用户测试里就遇到了:按钮开着但画面没虚化,
  // 因为代码默默退回了画原帧)。宁可边缘粗一点,也不能让这个功能看起来是坏的。
  if (!maskData || maskW === 0 || maskH === 0) {
    if (landmarks.length > 0) {
      drawBlurredFromLandmarks(ctx, video, landmarks, w, h)
      return
    }
    ctx.filter = 'none'
    ctx.drawImage(video, 0, 0, w, h)
    return
  }

  // 1. 背景:模糊的整帧
  ctx.filter = `blur(${BLUR_PX}px)`
  ctx.drawImage(video, 0, 0, w, h)
  ctx.filter = 'none'

  const { sharp, mask } = getScratch(w, h, maskW, maskH)

  // 2. 蒙版 → alpha 通道
  const mctx = mask.getContext('2d')
  if (!mctx) return
  const img = mctx.createImageData(maskW, maskH)
  const px = img.data
  for (let i = 0; i < maskData.length; i++) {
    const p = maskData[i]
    const j = i * 4
    px[j] = 255
    px[j + 1] = 255
    px[j + 2] = 255
    px[j + 3] = p > CUTOFF ? 255 : 0
  }
  mctx.putImageData(img, 0, 0)

  // 3. 清晰帧 ∩ 蒙版 = 只剩人
  const sctx = sharp.getContext('2d')
  if (!sctx) return
  sctx.globalCompositeOperation = 'source-over'
  sctx.clearRect(0, 0, w, h)
  sctx.drawImage(video, 0, 0, w, h)
  sctx.globalCompositeOperation = 'destination-in'
  // 蒙版分辨率通常低于画面,放大时让它平滑一点,边缘不至于是锯齿
  sctx.imageSmoothingEnabled = true
  sctx.drawImage(mask, 0, 0, w, h)
  sctx.globalCompositeOperation = 'source-over'

  // 4. 人叠回模糊背景上
  ctx.drawImage(sharp, 0, 0)
}


/**
 * 兜底虚化:没有分割蒙版时,用关键点的包围盒围出一个圆角区域当作"人"。
 * 比蒙版粗糙得多 —— 它只是一个胶囊形,不贴合轮廓 —— 但背景确实糊了,
 * 而且办公室里要挡的就是背景里的人和白板,不需要像素级精度。
 */
function drawBlurredFromLandmarks(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  lms: Landmark[],
  w: number,
  h: number,
): void {
  const seen = lms.filter((p) => (p.visibility ?? 0) > 0.4)
  if (seen.length < 4) {
    ctx.filter = 'none'
    ctx.drawImage(video, 0, 0, w, h)
    return
  }

  // 🔴 这里**不翻** x。虚化画布挂的是 .cam,CSS 上已经有 scaleX(-1),
  // 画进去的是原始帧,翻转由 CSS 统一做。再翻一次区域就跑到另一边了。
  // (骨架画布挂的是 .overlay,没有 CSS 翻转,所以它才要在代码里翻)
  const xs = seen.map((p) => p.x * w)
  const ys = seen.map((p) => p.y * h)
  const pad = w * 0.11
  const x0 = Math.max(0, Math.min(...xs) - pad)
  const x1 = Math.min(w, Math.max(...xs) + pad)
  const y0 = Math.max(0, Math.min(...ys) - pad * 1.25)
  const y1 = Math.min(h, Math.max(...ys) + pad)

  ctx.filter = `blur(${BLUR_PX}px)`
  ctx.drawImage(video, 0, 0, w, h)
  ctx.filter = 'none'

  ctx.save()
  ctx.beginPath()
  const r = Math.min((x1 - x0) / 2, (y1 - y0) / 2, 90)
  ctx.moveTo(x0 + r, y0)
  ctx.arcTo(x1, y0, x1, y1, r)
  ctx.arcTo(x1, y1, x0, y1, r)
  ctx.arcTo(x0, y1, x0, y0, r)
  ctx.arcTo(x0, y0, x1, y0, r)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(video, 0, 0, w, h)
  ctx.restore()
}
