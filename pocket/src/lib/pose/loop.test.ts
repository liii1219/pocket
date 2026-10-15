import { describe, expect, it } from 'vitest'
import { CHECKERS, initState, type CheckState, type PoseChecker } from './checkers'
import { LM, type Landmark } from './angles'

/**
 * 模拟 CameraCoach 的逐帧循环。
 *
 * 🔴 为什么要有这组测试:单帧测试全过,实际却一次都数不出来。
 * 原因是组件把状态传进判定器、却没把返回的新状态写回去,等于每帧从头开始。
 * 单独测 checkXxx() 永远发现不了 —— 必须把"状态要在帧之间传下去"这件事也测掉。
 */
function runLoop(
  checker: PoseChecker,
  frames: Array<{ lms: Landmark[]; world: Landmark[] }>,
  stepMs = 60,
) {
  let state: CheckState = initState()
  let t = 0
  let last = null as ReturnType<PoseChecker> | null
  for (const f of frames) {
    t += stepMs
    last = checker(f.lms, state, t, f.world)
    state = last          // ← 组件里漏掉的就是这一行
  }
  return last!
}

/** 正对镜头坐着,tilt 度侧倾。 */
function pose(tilt: number): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.95 }))
  const put = (i: number, x: number, y: number, z = 0) => { lms[i] = { x, y, z, visibility: 0.95 } }
  const half = 0.11
  put(LM.leftShoulder, 0.5 - half, 0.38, 0)
  put(LM.rightShoulder, 0.5 + half, 0.38, 0)
  const earHalf = 0.4 * half
  const want = 0.75 * 2 * half
  const lateral = half - earHalf
  const headH = Math.sqrt(Math.max(1e-6, want * want - lateral * lateral))
  const tr = (tilt * Math.PI) / 180
  const ex = Math.cos(tr)
  const ey = -Math.sin(tr)
  put(LM.leftEar, 0.5 - earHalf * ex, 0.38 - headH - earHalf * ey)
  put(LM.rightEar, 0.5 + earHalf * ex, 0.38 - headH + earHalf * ey)
  return lms
}

const hold = (tilt: number, n: number) =>
  Array.from({ length: n }, () => { const p = pose(tilt); return { lms: p, world: p } })

describe('逐帧循环', () => {
  const checker = CHECKERS['neck-tilt']

  it('状态在帧之间传下去时,基线能量完并开始计数', () => {
    const out = runLoop(checker, [
      ...hold(0, 30),    // 静息,量基线
      ...hold(26, 25),   // 歪过去
      ...hold(0, 25),    // 回正 → 应该数一次
    ])
    expect(out.confident).toBe(true)
    expect(out.reps).toBe(1)
  })

  it('连做三次就数三次', () => {
    const cycle = [...hold(26, 20), ...hold(0, 20)]
    const out = runLoop(checker, [...hold(0, 30), ...cycle, ...cycle, ...cycle])
    expect(out.reps).toBe(3)
  })

  it('状态不传下去时一次都数不出来 —— 这就是之前的 bug', () => {
    // 故意复现:每帧都用全新的初始状态
    let t = 0
    let last = null as ReturnType<PoseChecker> | null
    for (const f of [...hold(0, 30), ...hold(26, 25), ...hold(0, 25)]) {
      t += 60
      last = checker(f.lms, initState(), t, f.world)
    }
    expect(last!.reps).toBe(0)
    expect(last!.confident).toBe(false)   // 基线永远量不完
  })

  it('基线量完之前不自信,量完之后自信', () => {
    expect(runLoop(checker, hold(0, 10)).confident).toBe(false)
    expect(runLoop(checker, hold(0, 30)).confident).toBe(true)
  })
})
