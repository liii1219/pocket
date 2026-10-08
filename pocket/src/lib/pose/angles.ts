/**
 * angles — 关键点几何【纯函数】。不 import MediaPipe,只吃普通对象,所以 vitest 能直接跑。
 *
 * 坐标约定:MediaPipe 归一化坐标,x/y ∈ [0,1],**y 轴向下**(0 在画面顶部)。
 * 这一点很容易搞错,下面所有"更高/更低"的判断都按 y 越小越高来写。
 */

export interface Landmark {
  x: number
  y: number
  z?: number
  visibility?: number
}

/** MediaPipe Pose 的关键点下标(只列我们用到的)。 */
export const LM = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

/** 以 b 为顶点的夹角(度)。三点重合时返回 NaN,由调用方判为不可信。 */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x
  const aby = a.y - b.y
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const dot = abx * cbx + aby * cby
  const magA = Math.hypot(abx, aby)
  const magC = Math.hypot(cbx, cby)
  if (magA === 0 || magC === 0) return NaN
  const cos = Math.min(1, Math.max(-1, dot / (magA * magC)))
  return (Math.acos(cos) * 180) / Math.PI
}

/** 两点连线相对垂直方向的倾角(度)。0 = 完全竖直,90 = 完全水平。 */
export function tiltFromVerticalDeg(top: Landmark, bottom: Landmark): number {
  const dx = Math.abs(top.x - bottom.x)
  const dy = Math.abs(top.y - bottom.y)
  if (dx === 0 && dy === 0) return NaN
  return (Math.atan2(dx, dy) * 180) / Math.PI
}

/** 中点。用左右两侧求平均,比单侧稳。 */
export function mid(a: Landmark, b: Landmark): Landmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1),
  }
}

/**
 * 这些关键点够不够清楚。
 * 🔴 不够就必须说"看不清",绝不猜 —— 猜错动作的代价比不给反馈高得多。
 */
export function visibleEnough(lms: Landmark[], idx: number[], min = 0.6): boolean {
  if (lms.length === 0) return false
  return idx.every((i) => {
    const p = lms[i]
    return p != null && (p.visibility ?? 0) >= min && Number.isFinite(p.x) && Number.isFinite(p.y)
  })
}

/** 人有没有整个在画面里(边缘裁切会让角度算出鬼值)。 */
export function insideFrame(lms: Landmark[], idx: number[], margin = 0.02): boolean {
  return idx.every((i) => {
    const p = lms[i]
    if (p == null) return false
    return p.x > margin && p.x < 1 - margin && p.y > margin && p.y < 1 - margin
  })
}
