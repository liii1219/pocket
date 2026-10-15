import { describe, expect, it } from 'vitest'
import { checkArmRaise, checkElbow, checkNeckTilt, checkShrug, checkTwist, initState } from './checkers'
import { armRaiseDeg, headTiltDeg, shrugRatio, torsoTwistDeg, LM, type Landmark } from './angles'

/** 造一副只有上半身的骨架。角度单位是度。 */
function upper(
  o: { elbow?: number; tilt?: number; twist?: number; vis?: number; shrug?: number; raise?: number } = {},
): Landmark[] {
  const { elbow = 170, tilt = 0, twist = 0, vis = 0.95, shrug = 0.75, raise } = o
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }))
  const put = (i: number, x: number, y: number, z = 0) => { lms[i] = { x, y, z, visibility: vis } }

  // 肩膀:twist 让两肩在 z 上分开
  const half = 0.11
  const rad = (twist * Math.PI) / 180
  put(LM.leftShoulder, 0.5 - half * Math.cos(rad), 0.38, -half * Math.sin(rad))
  put(LM.rightShoulder, 0.5 + half * Math.cos(rad), 0.38, half * Math.sin(rad))

  // 耳朵:整个头当刚体绕头心转 tilt。
  // 🔴 不能把两只耳朵各自绕自己那侧肩膀摆 —— 那样耳线始终和肩线平行,侧倾恒为 0。
  // 肩线单位向量 u,竖直方向 v,耳线方向 = u 绕 v 转 tilt。
  const ux = Math.cos(rad)
  const uz = Math.sin(rad)
  const earHalf = 0.4 * half
  // 头心高度由 shrug 反推:耳到肩的距离要等于 shrug × 肩宽
  const want = shrug * (2 * half)
  const lateral = half - earHalf
  const headH = Math.sqrt(Math.max(1e-6, want * want - lateral * lateral))
  const tr = (tilt * Math.PI) / 180
  const ex = ux * Math.cos(tr)
  const ez = uz * Math.cos(tr)
  const ey = -Math.sin(tr)
  const hx = 0.5
  const hy = 0.38 - headH
  const hz = 0
  put(LM.leftEar, hx - earHalf * ex, hy - earHalf * ey, hz - earHalf * ez)
  put(LM.rightEar, hx + earHalf * ex, hy + earHalf * ey, hz + earHalf * ez)

  // 手臂。raise 给定时,上臂和"指向对侧肩膀"的方向成 raise 度
  const a = (elbow * Math.PI) / 180
  for (const [s, e, w, sign] of [
    [LM.leftShoulder, LM.leftElbow, LM.leftWrist, -1],
    [LM.rightShoulder, LM.rightElbow, LM.rightWrist, 1],
  ] as const) {
    const s0 = lms[s]
    let ex: number, ey: number, ez: number
    if (raise == null) {
      ex = s0.x + sign * 0.02
      ey = 0.52
      ez = s0.z ?? 0
    } else {
      // 指向对侧肩膀的单位向量是 (-sign·cos(rad), 0, -sign·sin(rad))
      const r = (raise * Math.PI) / 180
      const ux = -sign * Math.cos(rad)
      const uz = -sign * Math.sin(rad)
      const L = 0.14
      ex = s0.x + L * (ux * Math.cos(r))
      ey = s0.y + L * Math.sin(r)
      ez = (s0.z ?? 0) + L * (uz * Math.cos(r))
    }
    put(e, ex, ey, ez)
    put(w, ex + 0.14 * Math.cos(a - Math.PI / 2), ey + 0.14 * Math.sin(a - Math.PI / 2), ez)
  }
  return lms
}

const clock = () => { let t = 0; return () => (t += 1800) }

describe('headTiltDeg', () => {
  it('不歪头约等于 0', () => expect(headTiltDeg(upper({ tilt: 0 }))).toBeLessThan(3))
  it('歪 25 度能测出来', () => expect(headTiltDeg(upper({ tilt: 25 }))).toBeGreaterThan(20))
  it('左右对称,给的是绝对值', () => {
    expect(headTiltDeg(upper({ tilt: 25 }))).toBeCloseTo(headTiltDeg(upper({ tilt: -25 })), 0)
  })
})

describe('torsoTwistDeg', () => {
  it('正对镜头约等于 0', () => expect(torsoTwistDeg(upper({ twist: 0 }))).toBeLessThan(2))
  it('转 40 度能测出来', () => expect(torsoTwistDeg(upper({ twist: 40 }))).toBeGreaterThan(35))
})

describe('checkNeckTilt', () => {
  it('歪过去再回正数一次', () => {
    const t = clock()
    let s = initState()
    { const w = upper({ tilt: 0 }); s = checkNeckTilt(w, s, t(), w) }
    { const w = upper({ tilt: 28 }); s = checkNeckTilt(w, s, t(), w) }
    const w2 = upper({ tilt: 2 }); const out = checkNeckTilt(w2, s, t(), w2)
    expect(out.reps).toBe(1)
    expect(out.confident).toBe(true)
  })
  it('幅度不够会提示再远一点', () => {
    const t = clock()
    let s = initState()
    { const w = upper({ tilt: 0 }); s = checkNeckTilt(w, s, t(), w) }
    { const w = upper({ tilt: 17 }); s = checkNeckTilt(w, s, t(), w) }
    const w2 = upper({ tilt: 2 }); const out = checkNeckTilt(w2, s, t(), w2)
    expect(out.reps).toBe(1)
    expect(out.cue).toMatch(/further/)
  })
  it('只用上半身,没有腿也能判', () => {
    const lms = upper({ tilt: 28 })
    for (const i of [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]) {
      lms[i] = { x: 0.5, y: 1.5, z: 0, visibility: 0 }
    }
    expect(checkNeckTilt(lms, initState(), 0, lms).confident).toBe(true)
  })
})

describe('checkTwist', () => {
  it('转过去再回正数一次', () => {
    const t = clock()
    let s = initState()
    const w0 = upper({ twist: 0 }); const w40 = upper({ twist: 40 })
    s = checkTwist(w0, s, t(), w0)
    s = checkTwist(w40, s, t(), w40)
    const out = checkTwist(w0, s, t(), w0)
    expect(out.reps).toBe(1)
  })
  it('没有 world 坐标时诚实说判不了,不乱数', () => {
    const out = checkTwist(upper({ twist: 40 }), initState(), 0)
    expect(out.confident).toBe(false)
    expect(out.reps).toBe(0)
  })
})

describe('checkElbow', () => {
  it('弯到底再伸直数一次', () => {
    const t = clock()
    let s = initState()
    s = checkElbow(upper({ elbow: 170 }), s, t())
    s = checkElbow(upper({ elbow: 85 }), s, t())
    const out = checkElbow(upper({ elbow: 168 }), s, t())
    expect(out.reps).toBe(1)
    // 弯到位了就不该再提醒幅度(cue 为 null 表示没话说)
    expect(out.cue ?? '').not.toMatch(/further/)
  })
  it('弯得不够提示再弯一点', () => {
    const t = clock()
    let s = initState()
    s = checkElbow(upper({ elbow: 170 }), s, t())
    s = checkElbow(upper({ elbow: 118 }), s, t())
    const out = checkElbow(upper({ elbow: 168 }), s, t())
    expect(out.cue).toMatch(/further/)
  })
})


/* ============================================================
   旋转不变性 —— "对机位没要求"的严格证明
   把整副骨架绕竖直轴转任意角度(等价于人换个朝向站),
   测出来的量必须不变。
   ============================================================ */

/** 绕 Y 轴旋转整副骨架 deg 度。 */
function rotateY(lms: Landmark[], deg: number): Landmark[] {
  const a = (deg * Math.PI) / 180
  const c = Math.cos(a)
  const s = Math.sin(a)
  return lms.map((p) => ({
    x: p.x * c + (p.z ?? 0) * s,
    y: p.y,
    z: -p.x * s + (p.z ?? 0) * c,
    visibility: p.visibility,
  }))
}

describe('旋转不变性', () => {
  const base = upper({ tilt: 25, elbow: 120 })

  it('头侧倾:人转任意角度,测出来的角不变', () => {
    const ref = headTiltDeg(base)
    for (const deg of [15, 35, 60, 90, 135, 180, -45]) {
      expect(headTiltDeg(rotateY(base, deg))).toBeCloseTo(ref, 4)
    }
  })

  it('耸肩比值:人转任意角度,比值不变', () => {
    const ref = shrugRatio(base)
    for (const deg of [20, 50, 90, 160, -70]) {
      expect(shrugRatio(rotateY(base, deg))).toBeCloseTo(ref, 6)
    }
  })

  it('侧平举角:人转任意角度,角度不变', () => {
    const ref = armRaiseDeg(base)
    for (const deg of [25, 70, 110, -30]) {
      expect(armRaiseDeg(rotateY(base, deg))).toBeCloseTo(ref, 4)
    }
  })

  it('对照:躯干扭转**会**随朝向变 —— 它测的就是相对镜头的朝向', () => {
    const ref = torsoTwistDeg(base)
    expect(torsoTwistDeg(rotateY(base, 45))).not.toBeCloseTo(ref, 1)
  })
})

describe('checkShrug', () => {
  it('耸起来再放下数一次', () => {
    const t = clock()
    let s = initState()
    const relaxed = upper({ shrug: 0.75 })
    const up = upper({ shrug: 0.55 })
    s = checkShrug(relaxed, s, t(), relaxed)
    s = checkShrug(up, s, t(), up)
    const out = checkShrug(relaxed, s, t(), relaxed)
    expect(out.reps).toBe(1)
    expect(out.confident).toBe(true)
  })
  it('耸得不够提示抬高一点', () => {
    const t = clock()
    let s = initState()
    const relaxed = upper({ shrug: 0.75 })
    const half = upper({ shrug: 0.66 })
    s = checkShrug(relaxed, s, t(), relaxed)
    s = checkShrug(half, s, t(), half)
    const out = checkShrug(relaxed, s, t(), relaxed)
    expect(out.cue).toMatch(/higher/)
  })
})

describe('checkArmRaise', () => {
  it('举起来再放下数一次', () => {
    const t = clock()
    let s = initState()
    const down = upper({ raise: 95 })
    const up = upper({ raise: 20 })
    s = checkArmRaise(down, s, t(), down)
    s = checkArmRaise(up, s, t(), up)
    const out = checkArmRaise(down, s, t(), down)
    expect(out.reps).toBe(1)
  })
  it('没有 world 坐标时不乱数', () => {
    const out = checkArmRaise(upper({ raise: 20 }), initState(), 0)
    expect(out.confident).toBe(false)
    expect(out.reps).toBe(0)
  })
})
