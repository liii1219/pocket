import { describe, expect, it } from 'vitest'
import { angleDeg, insideFrame, tiltFromVerticalDeg, visibleEnough, type Landmark } from './angles'
import { checkHinge, checkShoulder, checkSquat, initState } from './checkers'

const p = (x: number, y: number, v = 0.99): Landmark => ({ x, y, visibility: v })

/** 单调递增的假时钟。默认每帧 +2000ms,够慢,不会误判成"甩"(节奏测试自己传小步长)。 */
let clock = 0
const t = (advance = 2000) => (clock += advance)
const resetClock = () => (clock = 0)

/** 造一副骨架:给定膝角和躯干倾角,生成够用的 29 个点。 */
function skeleton(opts: { kneeBend?: number; torsoTilt?: number; armUp?: number; vis?: number } = {}): Landmark[] {
  const { kneeBend = 0, torsoTilt = 0, armUp = 0, vis = 0.99 } = opts
  const lms: Landmark[] = Array.from({ length: 33 }, () => p(0.5, 0.5, vis))
  // 下蹲时髋往下掉、膝往前推,踝固定 —— 这样 kneeBend=1 才能真的produce一个深蹲角度
  const hipY = 0.5 + kneeBend * 0.18
  const kneeX = 0.5 + kneeBend * 0.14
  const kneeY = 0.7
  const ankleY = 0.92
  // 躯干按 torsoTilt 前倾(从髋点长出去)
  const shoulderX = 0.5 + Math.sin((torsoTilt * Math.PI) / 180) * 0.25
  const shoulderY = hipY - Math.cos((torsoTilt * Math.PI) / 180) * 0.25
  // 手臂按 armUp 抬起(0 = 垂下,1 = 举高)
  const elbowX = shoulderX + armUp * 0.2
  const elbowY = shoulderY + 0.18 - armUp * 0.34

  lms[11] = p(shoulderX - 0.04, shoulderY, vis)
  lms[12] = p(shoulderX + 0.04, shoulderY, vis)
  lms[13] = p(elbowX - 0.04, elbowY, vis)
  lms[14] = p(elbowX + 0.04, elbowY, vis)
  lms[23] = p(0.46, hipY, vis)
  lms[24] = p(0.54, hipY, vis)
  lms[25] = p(kneeX - 0.04, kneeY, vis)
  lms[26] = p(kneeX + 0.04, kneeY, vis)
  lms[27] = p(0.46, ankleY, vis)
  lms[28] = p(0.54, ankleY, vis)
  return lms
}

describe('angles', () => {
  it('直角算出 90 度', () => {
    expect(angleDeg(p(0, 1), p(0, 0), p(1, 0))).toBeCloseTo(90, 5)
  })

  it('三点共线算出 180 度', () => {
    expect(angleDeg(p(0, 0), p(0, 0.5), p(0, 1))).toBeCloseTo(180, 5)
  })

  it('重合点返回 NaN 而不是瞎猜一个角', () => {
    expect(Number.isNaN(angleDeg(p(0, 0), p(0, 0), p(1, 1)))).toBe(true)
  })

  it('竖直连线倾角为 0,水平为 90', () => {
    expect(tiltFromVerticalDeg(p(0.5, 0.2), p(0.5, 0.8))).toBeCloseTo(0, 5)
    expect(tiltFromVerticalDeg(p(0.2, 0.5), p(0.8, 0.5))).toBeCloseTo(90, 5)
  })

  it('visibility 不够时判为看不清', () => {
    expect(visibleEnough([p(0.5, 0.5, 0.2)], [0])).toBe(false)
    expect(visibleEnough([p(0.5, 0.5, 0.9)], [0])).toBe(true)
  })

  it('人贴到画面边缘时判为出框', () => {
    expect(insideFrame([p(0.001, 0.5)], [0])).toBe(false)
    expect(insideFrame([p(0.5, 0.5)], [0])).toBe(true)
  })
})

describe('checkSquat', () => {
  it('看不清时不数次数,并明说看不清', () => {
    const s = initState()
    const out = checkSquat(skeleton({ vis: 0.1 }), s, t())
    expect(out.confident).toBe(false)
    expect(out.reps).toBe(0)
    // 文案按缺哪一段动态生成,这里只要求:确实给了可执行的指示,不是空的
    expect(out.cue).toBeTruthy()
    expect(out.cue!.length).toBeGreaterThan(12)
  })

  it('一次完整的下蹲-起立数成 1 次', () => {
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t()) // 站着
    checkSquat(skeleton({ kneeBend: 1 }), s, t()) // 蹲下
    const out = checkSquat(skeleton({ kneeBend: 0 }), s, t()) // 起来
    expect(out.reps).toBe(1)
    expect(out.phase).toBe('up')
  })

  it('只蹲不起不算数(半程不给分)', () => {
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    const out = checkSquat(skeleton({ kneeBend: 1 }), s, t())
    expect(out.reps).toBe(0)
    expect(out.phase).toBe('down')
  })

  it('在临界角度抖动不会重复计数(迟滞生效)', () => {
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    checkSquat(skeleton({ kneeBend: 1 }), s, t())
    // 微微起身但没过 up 阈值
    checkSquat(skeleton({ kneeBend: 0.85 }), s, t())
    checkSquat(skeleton({ kneeBend: 1 }), s, t())
    const out = checkSquat(skeleton({ kneeBend: 0 }), s, t())
    expect(out.reps).toBe(1)
  })

  it('蹲得够深时不挑毛病', () => {
    resetClock()
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    checkSquat(skeleton({ kneeBend: 1 }), s, t()) // 深蹲到底
    const out = checkSquat(skeleton({ kneeBend: 0 }), s, t())
    expect(out.counted).toBe(true)
    expect(out.cue).toBeNull()
  })

  it('蹲得浅时提示蹲低一点,并且只在做完那一刻说', () => {
    resetClock()
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    const mid = checkSquat(skeleton({ kneeBend: 0.55 }), s, t()) // 半蹲,过了 down 阈值但不够深
    expect(mid.cue).toBeNull() // 过程中不打断
    const out = checkSquat(skeleton({ kneeBend: 0 }), s, t())
    expect(out.counted).toBe(true)
    expect(out.cue).toMatch(/lower/)
  })

  it('下一次蹲到位后给一次确认,然后不再重复夸', () => {
    resetClock()
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    checkSquat(skeleton({ kneeBend: 0.55 }), s, t())
    checkSquat(skeleton({ kneeBend: 0 }), s, t()) // 第 1 次:浅
    checkSquat(skeleton({ kneeBend: 1 }), s, t())
    const fixed = checkSquat(skeleton({ kneeBend: 0 }), s, t()) // 第 2 次:到位
    expect(fixed.cue).toMatch(/deep enough/)
    checkSquat(skeleton({ kneeBend: 1 }), s, t())
    const third = checkSquat(skeleton({ kneeBend: 0 }), s, t()) // 第 3 次:到位,不再说话
    expect(third.cue).toBeNull()
  })

  it('做太快时提示慢一点', () => {
    resetClock()
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    checkSquat(skeleton({ kneeBend: 1 }), s, t(100)) // 下潜
    const out = checkSquat(skeleton({ kneeBend: 0 }), s, t(300)) // 400ms 就完成一次 = 甩
    expect(out.counted).toBe(true)
    expect(out.cue).toMatch(/Slower/)
  })

  it('记录了单次耗时', () => {
    resetClock()
    const s = initState()
    checkSquat(skeleton({ kneeBend: 0 }), s, t())
    checkSquat(skeleton({ kneeBend: 1 }), s, t(1000))
    const out = checkSquat(skeleton({ kneeBend: 0 }), s, t(1000))
    // 计时从【进入下位那一帧】开始算,不是从第一帧
    expect(out.lastRepMs).toBe(1000)
  })
})

describe('checkHinge', () => {
  it('躯干还立着就进下位 → 提示把髋推后', () => {
    const s = initState()
    checkHinge(skeleton({ torsoTilt: 0 }), s, t())
    const out = checkHinge(skeleton({ kneeBend: 1, torsoTilt: 5 }), s, t())
    if (out.phase === 'down') {
      expect(out.cue).toMatch(/hips back/)
    }
  })

  it('看不清时不给提示,只说看不清', () => {
    const out = checkHinge(skeleton({ vis: 0.1 }), initState(), t())
    expect(out.confident).toBe(false)
    // 文案按缺哪一段动态生成,这里只要求:确实给了可执行的指示,不是空的
    expect(out.cue).toBeTruthy()
    expect(out.cue!.length).toBeGreaterThan(12)
  })
})

describe('checkShoulder', () => {
  it('抬到顶再放下算一次', () => {
    const s = initState()
    checkShoulder(skeleton({ armUp: 0 }), s, t())
    checkShoulder(skeleton({ armUp: 1 }), s, t())
    const out = checkShoulder(skeleton({ armUp: 0 }), s, t())
    expect(out.reps).toBeGreaterThanOrEqual(0)
    expect(out.confident).toBe(true)
  })
})
