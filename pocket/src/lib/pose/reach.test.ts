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
