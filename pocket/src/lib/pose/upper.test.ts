import { describe, expect, it } from 'vitest'
import { checkElbow, checkNeckTilt, checkTwist, initState } from './checkers'
import { headTiltDeg, torsoTwistDeg, LM, type Landmark } from './angles'

/** 造一副只有上半身的骨架。角度单位是度。 */
function upper(o: { elbow?: number; tilt?: number; twist?: number; vis?: number } = {}): Landmark[] {
  const { elbow = 170, tilt = 0, twist = 0, vis = 0.95 } = o
  const lms: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: vis }))
  const put = (i: number, x: number, y: number, z = 0) => { lms[i] = { x, y, z, visibility: vis } }

  // 肩膀:twist 让两肩在 z 上分开
  const half = 0.11
  const rad = (twist * Math.PI) / 180
  put(LM.leftShoulder, 0.5 - half * Math.cos(rad), 0.38, -half * Math.sin(rad))
  put(LM.rightShoulder, 0.5 + half * Math.cos(rad), 0.38, half * Math.sin(rad))

  // 耳朵:在肩线基础上再转 tilt
  const er = ((twist + tilt) * Math.PI) / 180
  put(LM.leftEar, 0.5 - 0.06 * Math.cos(er), 0.22 - 0.06 * Math.sin(er))
  put(LM.rightEar, 0.5 + 0.06 * Math.cos(er), 0.22 + 0.06 * Math.sin(er))

  // 手臂:肩在上,肘在下,腕按 elbow 角度摆
  const a = (elbow * Math.PI) / 180
  for (const [s, e, w, sign] of [
    [LM.leftShoulder, LM.leftElbow, LM.leftWrist, -1],
    [LM.rightShoulder, LM.rightElbow, LM.rightWrist, 1],
  ] as const) {
    const sx = lms[s].x
    put(e, sx + sign * 0.02, 0.52)
    put(w, sx + sign * 0.02 + 0.16 * Math.cos(a - Math.PI / 2), 0.52 + 0.16 * Math.sin(a - Math.PI / 2))
  }
  return lms
}

const clock = () => { let t = 0; return () => (t += 1800) }

describe('headTiltDeg', () => {
  it('不歪头约等于 0', () => expect(headTiltDeg(upper({ tilt: 0 }))).toBeLessThan(2))
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
    s = checkNeckTilt(upper({ tilt: 0 }), s, t())
    s = checkNeckTilt(upper({ tilt: 28 }), s, t())
    const out = checkNeckTilt(upper({ tilt: 2 }), s, t())
    expect(out.reps).toBe(1)
    expect(out.confident).toBe(true)
  })
  it('幅度不够会提示再远一点', () => {
    const t = clock()
    let s = initState()
    s = checkNeckTilt(upper({ tilt: 0 }), s, t())
    s = checkNeckTilt(upper({ tilt: 17 }), s, t())
    const out = checkNeckTilt(upper({ tilt: 2 }), s, t())
    expect(out.reps).toBe(1)
    expect(out.cue).toMatch(/further/)
  })
  it('只用上半身,没有腿也能判', () => {
    const lms = upper({ tilt: 28 })
    for (const i of [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]) {
      lms[i] = { x: 0.5, y: 1.5, z: 0, visibility: 0 }
    }
    expect(checkNeckTilt(lms, initState(), 0).confident).toBe(true)
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
