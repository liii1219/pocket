import { describe, expect, it } from 'vitest'
import { framingHint, LM, type Landmark } from './angles'

/** 全身都看得见的骨架,再按需要挖掉某些点。 */
function body(hide: number[] = [], offscreen: number[] = []): Landmark[] {
  const lms: Landmark[] = Array.from({ length: 33 }, (_, i) => ({
    x: 0.5, y: 0.1 + (i / 33) * 0.8, z: 0, visibility: 0.95,
  }))
  for (const i of hide) lms[i] = { ...lms[i], visibility: 0.1 }
  for (const i of offscreen) lms[i] = { ...lms[i], y: 0.995 }
  return lms
}

const REACH = [LM.leftShoulder, LM.rightShoulder, LM.leftWrist, LM.rightWrist]
const SQUAT = [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]
const HEAD = [LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder]

describe('framingHint 按判定器的实际需求给建议', () => {
  it('碰圆圈缺手腕 → 让你把手放进画面,不是让你侧身', () => {
    // 回归:原来一律按深蹲的需求判断,这种情况会落到"Try standing side-on",
    // 而碰圆圈恰恰要正对镜头,建议是反的。
    const h = framingHint(body([LM.leftWrist, LM.rightWrist]), REACH)
    expect(h).toMatch(/hands/)
    expect(h).not.toMatch(/side-on/)
  })

  it('手腕出画面(不是不可见)也算', () => {
    const h = framingHint(body([], [LM.leftWrist, LM.rightWrist]), REACH)
    expect(h).toMatch(/hands/)
  })

  it('只有一只手出画面 → 单独说', () => {
    const h = framingHint(body([LM.leftWrist]), REACH)
    expect(h).toMatch(/One hand/)
  })

  it('用头碰的玩法缺耳朵 → 说头,不说手', () => {
    const h = framingHint(body([LM.leftEar, LM.rightEar]), HEAD)
    expect(h).toMatch(/head/)
  })

  it('深蹲缺脚 → 让你退后', () => {
    expect(framingHint(body([LM.leftAnkle, LM.rightAnkle]), SQUAT)).toMatch(/feet|step back/i)
  })

  it('深蹲只剩上半身 → 让你把相机挪远或放地上', () => {
    const h = framingHint(
      body([LM.leftAnkle, LM.rightAnkle, LM.leftKnee, LM.rightKnee]),
      SQUAT,
    )
    expect(h).toMatch(/upper body|floor/i)
  })

  it('什么都没有 → 最基本的那句', () => {
    expect(framingHint([], REACH)).toMatch(/Stand where/)
  })
})
