import { describe, expect, it } from 'vitest'
import { composeSession, type SessionInput } from './session'

const base: SessionInput = { minutes: 15, place: 'desk', sore: [], energy: 'ok', quietOnly: true, alone: true }

describe('composeSession', () => {
  it('同样的输入给同样的输出(可复现,不随机)', () => {
    const a = composeSession(base)
    const b = composeSession(base)
    expect(a.items.map((i) => i.movement.id)).toEqual(b.items.map((i) => i.movement.id))
  })

  it('不会超出空档预算', () => {
    const s = composeSession({ ...base, minutes: 5 })
    const spent = s.items.reduce((n, i) => n + i.movement.costSeconds, 0)
    expect(spent).toBeLessThanOrEqual(5 * 60 - 60)
  })

  it('时间太短就诚实地返回空课,不硬凑', () => {
    const s = composeSession({ ...base, minutes: 1 })
    expect(s.items).toHaveLength(0)
    expect(s.headline).toMatch(/Take the gap off/)
  })

  it('办公桌场合只给能穿上班衣服做的动作', () => {
    const s = composeSession({ ...base, place: 'desk' })
    expect(s.items.every((i) => i.movement.workClothes)).toBe(true)
  })

  it('报了酸痛的部位不会被压到', () => {
    const s = composeSession({ ...base, minutes: 20, sore: ['knee', 'hip'] })
    for (const i of s.items) {
      expect(i.movement.loads).not.toContain('knee')
      expect(i.movement.loads).not.toContain('hip')
    }
  })

  it('低精力时只给活动度动作', () => {
    const s = composeSession({ ...base, minutes: 20, energy: 'low' })
    expect(s.items.length).toBeGreaterThan(0)
    expect(s.items.every((i) => i.movement.pattern === 'mobility')).toBe(true)
    expect(s.headline).toMatch(/Nothing hard today/)
  })

  it('力量动作不重复模式,活动度动作不重复部位', () => {
    // 规则不是"pattern 全不同":颈、腕、踝都是 mobility,它们该能同时出现。
    // 真正的规则是 —— 力量动作按 pattern 去重,活动度动作按目标部位去重。
    const s = composeSession({ ...base, minutes: 30 })
    const keys = s.items.map((i) =>
      i.movement.pattern === 'mobility'
        ? `mobility:${i.movement.loads.join(',')}`
        : i.movement.pattern,
    )
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('加了坐姿动作之后,有人在场也能排满一节课', () => {
    // 回归:动作全挤在四个 pattern 里时,按 pattern 去重会把课压到四个,
    // 加的动作越多课反而越短。
    const s = composeSession({ ...base, minutes: 10, alone: false })
    expect(s.items.length).toBeGreaterThanOrEqual(5)
  })

  it('每个动作都带一句为什么', () => {
    const s = composeSession({ ...base, minutes: 20 })
    expect(s.items.length).toBeGreaterThan(0)
    expect(s.items.every((i) => i.reason.trim().length > 0)).toBe(true)
  })

  it('有摄像头判定的动作排在前面', () => {
    const s = composeSession({ ...base, minutes: 20 })
    const firstHasCheck = Boolean(s.items[0]?.movement.poseCheck)
    expect(firstHasCheck).toBe(true)
  })

  it('地板场合允许需要地面的动作', () => {
    const s = composeSession({ ...base, minutes: 30, place: 'floor' })
    expect(s.items.length).toBeGreaterThan(0)
  })

  /* --- 酸痛过滤:标得越多不该拿得越少 ------------------------------- */

  it('酸痛部位不会被力量动作压到', () => {
    const sore = ['shoulder', 'hip', 'knee', 'ankle', 'wrist'] as const
    const s = composeSession({ ...base, minutes: 10, sore: [...sore] })
    for (const i of s.items) {
      if (i.movement.pattern === 'mobility') continue
      expect(i.movement.loads.some((a) => sore.includes(a as never))).toBe(false)
    }
  })

  it('标了五个部位酸痛,仍然给得出不止一个动作', () => {
    // 回归:旧规则一刀切排除所有压到酸痛部位的动作,又因为 mobility 全是同一个 pattern
    // 被去重成一个,结果用户标得越诚实拿到的越少,最后只剩 1 个动作。
    const s = composeSession({ ...base, minutes: 10, sore: ['shoulder', 'hip', 'knee', 'ankle', 'wrist'] })
    expect(s.items.length).toBeGreaterThan(1)
  })

  it('针对酸痛部位的活动度动作会保留,并说明原因', () => {
    // 断言行为,不断言某个具体动作 —— 排序规则变了之后具体是哪一个会变,
    // 但"针对酸痛部位的活动度动作留下来并解释自己"这条规则不该变。
    const s = composeSession({ ...base, minutes: 10, sore: ['shoulder'] })
    const targeted = s.items.find(
      (i) => i.movement.pattern === 'mobility' && i.movement.loads.includes('shoulder'),
    )
    expect(targeted).toBeDefined()
    expect(targeted!.reason).toMatch(/shoulder you marked sore/)
  })

  it('标了很多酸痛时,标题要交代课为什么变短', () => {
    const s = composeSession({ ...base, minutes: 10, sore: ['shoulder', 'hip', 'knee'] })
    expect(s.headline).toMatch(/marked a lot as sore/)
  })

  it('不酸痛时的课不受影响', () => {
    const s = composeSession({ ...base, minutes: 10 })
    expect(s.items).toHaveLength(6)
    expect(s.headline).not.toMatch(/sore/)
  })

  it('只有一个动作时用单数', () => {
    const s = composeSession({ ...base, minutes: 2 })
    expect(s.headline).not.toMatch(/1 movements/)
  })

  /* --- visibility:周围有人时只给看不出来的动作 --------------------- */

  it('周围有人时不给显眼的动作', () => {
    const s = composeSession({ ...base, minutes: 10, alone: false })
    expect(s.items.length).toBeGreaterThan(0)
    expect(s.items.every((i) => i.movement.visibility === 'discreet')).toBe(true)
  })

  it('周围有人时仍然排得满,不是只剩一个', () => {
    // 加入眼保健操/穴位按摩/坐姿拉伸之前,discreet 只有三个而且全是 mobility,
    // 会被 pattern 去重挤成一个。这条守住"有人在场也有完整一节课"。
    const s = composeSession({ ...base, minutes: 10, alone: false })
    expect(s.items.length).toBeGreaterThanOrEqual(3)
  })

  it('周围有人时标题要说清楚', () => {
    const s = composeSession({ ...base, minutes: 10, alone: false })
    expect(s.headline).toMatch(/Nothing here looks like exercising/)
  })

  it('一个人时拿得到显眼的动作', () => {
    const s = composeSession({ ...base, minutes: 10, alone: true })
    expect(s.items.some((i) => i.movement.visibility === 'obvious')).toBe(true)
  })
})
