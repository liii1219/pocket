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
  leftEar: 7,
  rightEar: 8,
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

/**
 * 以 b 为顶点的夹角(度)。三点重合时返回 NaN,由调用方判为不可信。
 *
 * 🔴 带 z 一起算。只用 x/y 的话,角度会随摄像头机位变 ——
 * 正对镜头拍深蹲时膝角会被投影压扁,明明蹲到位了也判"再低一点"。
 * 传进来的点如果有 z(worldLandmarks 有),就是真正的三维夹角,与机位无关。
 */
export function angleDeg(a: Landmark, b: Landmark, c: Landmark): number {
  const abx = a.x - b.x
  const aby = a.y - b.y
  const abz = (a.z ?? 0) - (b.z ?? 0)
  const cbx = c.x - b.x
  const cby = c.y - b.y
  const cbz = (c.z ?? 0) - (b.z ?? 0)
  const dot = abx * cbx + aby * cby + abz * cbz
  const magA = Math.hypot(abx, aby, abz)
  const magC = Math.hypot(cbx, cby, cbz)
  if (magA === 0 || magC === 0) return NaN
  const cos = Math.min(1, Math.max(-1, dot / (magA * magC)))
  return (Math.acos(cos) * 180) / Math.PI
}

/**
 * 指数滑动平均,用来压关键点抖动。
 *
 * 为什么要平滑:模型逐帧独立推理,静止不动时关键点仍会抖 1–2 个像素,
 * 换算成角度就是 ±3° 左右的噪声。状态机用迟滞阈值扛住了误计数,
 * 但"最小膝角"是取整个过程的极值 —— 噪声会让它偏低,把没蹲到位的判成到位。
 *
 * alpha 越小越稳也越迟钝。0.5 在 30fps 下大约 2 帧收敛,肉眼觉不出延迟。
 */
const SMOOTH_ALPHA = 0.5

export function smoothLandmarks(prev: Landmark[] | null, next: Landmark[]): Landmark[] {
  if (!prev || prev.length !== next.length) return next
  return next.map((n, i) => {
    const p = prev[i]
    return {
      x: p.x + (n.x - p.x) * SMOOTH_ALPHA,
      y: p.y + (n.y - p.y) * SMOOTH_ALPHA,
      z: (p.z ?? 0) + ((n.z ?? 0) - (p.z ?? 0)) * SMOOTH_ALPHA,
      // 可见度不平滑:它是"看不看得见"的判断依据,要立刻反应
      visibility: n.visibility,
    }
  })
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

/**
 * 看不清的时候,告诉用户**该怎么办**,而不是只说"看不清"。
 *
 * 用户测试里出现的情况:人坐在笔记本前做深蹲,画面只到腰,膝和踝根本不在框里。
 * 原来一律回"I cannot see you well enough",用户不知道是光线问题、站位问题还是坏了。
 * 这里按缺哪一段给出具体动作。
 */
export function framingHint(lms: Landmark[], idx: number[]): string {
  if (lms.length === 0) return 'Stand where the camera can see you.'

  const missing = (i: number) => {
    const p = lms[i]
    return p == null || (p.visibility ?? 0) < 0.5
  }
  const outside = (i: number) => {
    const p = lms[i]
    return p != null && (p.x <= 0.02 || p.x >= 0.98 || p.y <= 0.02 || p.y >= 0.98)
  }
  const bad = (i: number) => missing(i) || outside(i)

  const needsFeet = idx.includes(LM.leftAnkle) || idx.includes(LM.rightAnkle)
  const feetBad = bad(LM.leftAnkle) && bad(LM.rightAnkle)
  const kneesBad = bad(LM.leftKnee) && bad(LM.rightKnee)
  const hipsBad = bad(LM.leftHip) && bad(LM.rightHip)

  if (needsFeet && feetBad) {
    if (hipsBad) return 'Too close. Step back until your whole body fits in the picture.'
    if (kneesBad) return 'I can only see your upper body. Move the camera back, or put it on the floor.'
    return 'Your feet are out of shot. Step back a little.'
  }
  if (bad(LM.leftShoulder) && bad(LM.rightShoulder)) {
    return 'I have lost your shoulders. Face the camera and make sure the room is lit.'
  }
  return 'I cannot see you well enough to check this. Try standing side-on to the camera.'
}

/** 三维向量夹角(度)。两个向量都给对象,只取 x/y/z。 */
function vecAngleDeg(a: Vec3, b: Vec3): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z
  const ma = Math.hypot(a.x, a.y, a.z)
  const mb = Math.hypot(b.x, b.y, b.z)
  if (ma === 0 || mb === 0) return NaN
  const cos = Math.min(1, Math.max(-1, dot / (ma * mb)))
  return (Math.acos(cos) * 180) / Math.PI
}

interface Vec3 { x: number; y: number; z: number }
const sub = (a: Landmark, b: Landmark): Vec3 => ({
  x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0),
})
const dist3 = (a: Landmark, b: Landmark): number => {
  const v = sub(a, b)
  return Math.hypot(v.x, v.y, v.z)
}

/**
 * 头的侧倾角(度)。0 = 正,越大越偏。
 *
 * 🔴 对机位没有要求:算的是**两耳连线和两肩连线的三维夹角**。
 * 三维向量之间的夹角在旋转下不变 —— 你正对、侧对、斜着对镜头,算出来都一样。
 * (旧版本用的是画面上的二维夹角,侧身时投影会把角度压扁,所以必须正对镜头。)
 * 必须传 worldLandmarks。
 */
export function headTiltDeg(world: Landmark[]): number {
  const le = world[LM.leftEar]
  const re = world[LM.rightEar]
  const ls = world[LM.leftShoulder]
  const rs = world[LM.rightShoulder]
  if (!le || !re || !ls || !rs) return NaN
  return vecAngleDeg(sub(re, le), sub(rs, ls))
}

/**
 * 耸肩幅度:肩到耳的距离 ÷ 两肩宽度。
 *
 * 🔴 对机位没有要求,而且对体型也没有要求:
 * 两个都是三维距离,比值在旋转下不变,除以肩宽又抵消了人离镜头远近和身材差异。
 * 放松时约 0.75,耸到底约 0.55(肩膀抬高,到耳朵的距离变短)。
 * 必须传 worldLandmarks。
 */
export function shrugRatio(world: Landmark[]): number {
  const le = world[LM.leftEar]
  const re = world[LM.rightEar]
  const ls = world[LM.leftShoulder]
  const rs = world[LM.rightShoulder]
  if (!le || !re || !ls || !rs) return NaN
  const width = dist3(ls, rs)
  if (width === 0) return NaN
  return (dist3(le, ls) + dist3(re, rs)) / 2 / width
}

/**
 * 手臂相对躯干抬起的角度(度)。
 *
 * 🔴 不用髋部 —— 参照轴取**对侧肩膀**,不是"髋到肩"那条线。
 * 人坐在桌后时髋部常常被桌子挡住,旧版本因此直接判"看不清"。
 * 手臂自然下垂时约 95°,侧平举约 10°,所以也是"角度越小越到位"。
 * 必须传 worldLandmarks。
 */
export function armRaiseDeg(world: Landmark[]): number {
  const ls = world[LM.leftShoulder]
  const rs = world[LM.rightShoulder]
  const le = world[LM.leftElbow]
  const re = world[LM.rightElbow]
  if (!ls || !rs || !le || !re) return NaN
  const left = vecAngleDeg(sub(le, ls), sub(rs, ls))
  const right = vecAngleDeg(sub(re, rs), sub(ls, rs))
  if (Number.isNaN(left) || Number.isNaN(right)) return NaN
  return (left + right) / 2
}

/**
 * 躯干相对镜头的扭转角(度)。0 = 正对镜头,90 = 完全侧身。
 *
 * 用**三维**肩膀连线在水平面上的朝向:正对镜头时两肩的 z 相同,转体时 z 差变大。
 * 必须传 worldLandmarks —— 画面坐标的 z 不是米制的,算出来不稳。
 * 不需要髋部,所以人坐在桌后、下半身被桌子挡住也能判。
 */
export function torsoTwistDeg(world: Landmark[]): number {
  const ls = world[LM.leftShoulder]
  const rs = world[LM.rightShoulder]
  if (!ls || !rs) return NaN
  const dx = Math.abs(rs.x - ls.x)
  const dz = Math.abs((rs.z ?? 0) - (ls.z ?? 0))
  if (dx === 0 && dz === 0) return NaN
  return (Math.atan2(dz, dx) * 180) / Math.PI
}
