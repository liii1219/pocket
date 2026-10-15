import { describe, expect, it } from 'vitest'
import { checkReach, initState, type CheckState } from './checkers'
import { LM, type Landmark } from './angles'

/** 手腕放在指定位置的骨架。其余点给足可见度。 */
function withWrists(lx: number, ly: number, rx: number, ry: number): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }))
  lms[LM.leftShoulder] = { x: 0.39, y: 0.38, z: 0, visibility: 0.95 }
  lms[LM.rightShoulder] = { x: 0.61, y: 0.38, z: 0, visibility: 0.95 }
  lms[LM.leftWrist] = { x: lx, y: ly, z: 0, visibility: 0.95 }
  lms[LM.rightWrist] = { x: rx, y: ry, z: 0, visibility: 0.95 }
  return lms
}

/** 两手都垂在身侧 */
const resting = () => withWrists(0.4, 0.75, 0.6, 0.75)

describe('碰圆圈', () => {
  it('第一帧给出一个目标,还不计数', () => {
    const out = checkReach(resting(), initState(), 0)
    expect(out.targetX).not.toBeNull()
    expect(out.reps).toBe(0)
    expect(out.confident).toBe(true)
  })

  it('目标一定离手够远 —— 原地不动碰不到', () => {
    const out = checkReach(resting(), initState(), 0)
    const d = Math.min(
      Math.hypot(out.targetX! - 0.4, out.targetY! - 0.75),
      Math.hypot(out.targetX! - 0.6, out.targetY! - 0.75),
    )
    expect(d).toBeGreaterThan(0.085)
  })

  it('手碰到就算一次,并换一个新位置', () => {
    let s: CheckState = checkReach(resting(), initState(), 0)
    const tx = s.targetX!
    const ty = s.targetY!
    const out = checkReach(withWrists(tx, ty, 0.6, 0.75), s, 1000)
    expect(out.reps).toBe(1)
    expect(out.counted).toBe(true)
    expect(out.targetX !== tx || out.targetY !== ty).toBe(true)
  })

  it('另一只手碰到也算', () => {
    let s: CheckState = checkReach(resting(), initState(), 0)
    const out = checkReach(withWrists(0.4, 0.75, s.targetX!, s.targetY!), s, 1000)
    expect(out.reps).toBe(1)
  })

  it('手停在圈上不会一直加 —— 碰到后目标立刻换走', () => {
    let s: CheckState = checkReach(resting(), initState(), 0)
    const tx = s.targetX!, ty = s.targetY!
    s = checkReach(withWrists(tx, ty, 0.6, 0.75), s, 1000)
    // 手没动,但目标已经换到别处了
    const out = checkReach(withWrists(tx, ty, 0.6, 0.75), s, 1100)
    expect(out.reps).toBe(1)
  })

  it('连碰五次就数五次', () => {
    let s: CheckState = checkReach(resting(), initState(), 0)
    for (let i = 0; i < 5; i++) {
      s = checkReach(withWrists(s.targetX!, s.targetY!, 0.6, 0.75), s, (i + 1) * 1000)
      // 碰完把手收回来,免得新目标刚好落在手上
      s = checkReach(resting(), s, (i + 1) * 1000 + 50)
    }
    expect(s.reps).toBe(5)
  })

  it('看不见手腕时不计数', () => {
    const lms = resting()
    lms[LM.leftWrist] = { x: 0.4, y: 0.75, z: 0, visibility: 0.1 }
    lms[LM.rightWrist] = { x: 0.6, y: 0.75, z: 0, visibility: 0.1 }
    const out = checkReach(lms, initState(), 0)
    expect(out.confident).toBe(false)
    expect(out.reps).toBe(0)
  })

  it('不需要三维坐标 —— 全在画面坐标里算', () => {
    // 不传 world 也能正常工作,和扭转/耸肩不一样
    let s: CheckState = checkReach(resting(), initState(), 0)
    const out = checkReach(withWrists(s.targetX!, s.targetY!, 0.6, 0.75), s, 1000)
    expect(out.reps).toBe(1)
  })
})

/* 蒙版有效性 —— 虚化为什么会"开着却没糊" */
import { describe as d2, it as i2, expect as e2 } from 'vitest'

d2('蒙版有效性', () => {
  // 把 blur.ts 里的判断逻辑原样写一遍来测:它是模块私有的,
  // 但这条规则值得锁住 —— 实测遇到过整帧都判成"人"的蒙版。
  const CUTOFF = 0.35
  const usable = (mask: Float32Array) => {
    const step = Math.max(1, Math.floor(mask.length / 4000))
    let hit = 0, n = 0
    for (let i = 0; i < mask.length; i += step) { if (mask[i] > CUTOFF) hit++; n++ }
    const frac = hit / n
    return frac > 0.02 && frac < 0.85
  }

  i2('整帧都是人 → 不可用', () => {
    e2(usable(new Float32Array(10000).fill(1))).toBe(false)
  })
  i2('整帧都不是人 → 不可用', () => {
    e2(usable(new Float32Array(10000).fill(0))).toBe(false)
  })
  i2('人占三成 → 可用', () => {
    const m = new Float32Array(10000)
    m.fill(1, 0, 3000)
    e2(usable(m)).toBe(true)
  })
})

/* 推广出来的三个目标玩法 */
import { describe as d3, it as i3, expect as e3 } from 'vitest'
import { checkHeadTarget, checkReachCross, checkReachHigh, targetRadius } from './checkers'

/** 头在指定位置的骨架(耳朵中点即为触点)。 */
function withHead(hx: number, hy: number): Landmark[] {
  const lms = withWrists(0.4, 0.75, 0.6, 0.75)
  lms[LM.leftEar] = { x: hx - 0.04, y: hy, z: 0, visibility: 0.95 }
  lms[LM.rightEar] = { x: hx + 0.04, y: hy, z: 0, visibility: 0.95 }
  return lms
}

d3('目标玩法的位置分布', () => {
  i3('reach-high 的目标全在头顶上方', () => {
    // 连碰十次,看看给出来的位置是不是都很高
    let s = checkReachHigh(resting(), initState(), 0)
    const ys: number[] = []
    for (let i = 0; i < 10; i++) {
      ys.push(s.targetY!)
      s = checkReachHigh(withWrists(s.targetX!, s.targetY!, 0.6, 0.75), s, (i + 1) * 1000)
      s = checkReachHigh(resting(), s, (i + 1) * 1000 + 50)
    }
    e3(Math.max(...ys)).toBeLessThan(0.2)
  })

  i3('reach-cross 的目标全在身体两侧远端', () => {
    let s = checkReachCross(resting(), initState(), 0)
    const xs: number[] = []
    for (let i = 0; i < 10; i++) {
      xs.push(s.targetX!)
      s = checkReachCross(withWrists(s.targetX!, s.targetY!, 0.6, 0.75), s, (i + 1) * 1000)
      s = checkReachCross(resting(), s, (i + 1) * 1000 + 50)
    }
    // 每个都远离中线
    e3(xs.every((x) => x < 0.15 || x > 0.85)).toBe(true)
  })
})

d3('用头碰目标', () => {
  i3('手碰到不算,必须用头', () => {
    const s = checkHeadTarget(withHead(0.5, 0.3), initState(), 0)
    // 把手放到目标上
    const lms = withHead(0.5, 0.3)
    lms[LM.leftWrist] = { x: s.targetX!, y: s.targetY!, z: 0, visibility: 0.95 }
    e3(checkHeadTarget(lms, s, 1000).reps).toBe(0)
  })

  i3('头碰到就算', () => {
    const s = checkHeadTarget(withHead(0.5, 0.3), initState(), 0)
    e3(checkHeadTarget(withHead(s.targetX!, s.targetY!), s, 1000).reps).toBe(1)
  })

  i3('头的判定圈比手的小', () => {
    e3(targetRadius('head-target')).toBeLessThan(targetRadius('reach-target'))
  })
})
