import { describe, expect, it } from 'vitest'
import { composeSession, maxSessionMinutes, type SessionInput } from './session'
import { MOVEMENTS } from './movements'

const base: SessionInput = { minutes: 15, sore: [], energy: 'ok', alone: true }

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

  it('不酸痛时不提酸痛', () => {
    const s = composeSession({ ...base, minutes: 10 })
    expect(s.items.length).toBeGreaterThan(0)
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
    // 断言语义不断言原句:要说清楚"看不出来是在运动",而且不能提"安静" ——
    // 判据是会不会被看见,不是会不会被听见。
    expect(s.headline).toMatch(/look like exercising/)
    expect(s.headline).not.toMatch(/quiet/i)
  })

  it('一个人时拿得到显眼的动作', () => {
    const s = composeSession({ ...base, minutes: 10, alone: true })
    expect(s.items.some((i) => i.movement.visibility === 'obvious')).toBe(true)
  })

  /* --- 动作数量 ----------------------------------------------------- */

  it('不指定数量时按时长估:时间越长动作越多', () => {
    const five = composeSession({ ...base, minutes: 5 }).items.length
    const twenty = composeSession({ ...base, minutes: 20 }).items.length
    expect(twenty).toBeGreaterThan(five)
  })

  it('指定数量时就按指定的来', () => {
    const s = composeSession({ ...base, minutes: 20, maxItems: 3 })
    expect(s.items).toHaveLength(3)
  })

  it('指定的数量超过时间预算时,按预算截断,不硬凑', () => {
    const s = composeSession({ ...base, minutes: 5, maxItems: 8 })
    const spent = s.items.reduce((n, i) => n + i.movement.costSeconds, 0)
    expect(spent).toBeLessThanOrEqual(5 * 60 - 60)
  })

  /* --- 配不出来时要说清楚被什么拦住 --------------------------------- */

  it('排满了就没有缺口', () => {
    const s = composeSession({ ...base, minutes: 20, maxItems: 3 })
    expect(s.items).toHaveLength(3)
    expect(s.shortfall).toBe('none')
  })

  it('时间不够 → 报 time,而且池子里确实还有没用上的', () => {
    const s = composeSession({ ...base, minutes: 3, maxItems: 8 })
    expect(s.items.length).toBeLessThan(8)
    expect(s.shortfall).toBe('time')
  })

  it('动作本身不够 → 报 pool', () => {
    // 时间给足,但要的比库里能用的还多
    const s = composeSession({ ...base, minutes: 20, maxItems: 30 })
    expect(s.shortfall).toBe('pool')
  })

  it('有人在场时池子更小,缺口要如实报告', () => {
    const many = composeSession({ ...base, minutes: 20, maxItems: 30, alone: true })
    const few = composeSession({ ...base, minutes: 20, maxItems: 30, alone: false })
    expect(few.items.length).toBeLessThanOrEqual(many.items.length)
    expect(few.shortfall).toBe('pool')
  })

  it('wanted 记录的是用户要的数量,不是实际给的', () => {
    const s = composeSession({ ...base, minutes: 3, maxItems: 8 })
    expect(s.wanted).toBe(8)
    expect(s.items.length).toBeLessThan(8)
  })

  /* --- 时长要真的被用上 --------------------------------------------- */

  it('不指定数量时把时间填满,不卡在人为上限', () => {
    // 回归:自动数量原来写死最多八个,十三分钟之后时长滑块就失效了 ——
    // 说有十六分钟却给一节七分钟的课,那问时长没有意义。
    const ten = composeSession({ ...base, minutes: 10 })
    const twenty = composeSession({ ...base, minutes: 20 })
    expect(twenty.items.length).toBeGreaterThan(ten.items.length)
  })

  it('填满之后仍然不超预算', () => {
    for (const minutes of [5, 10, 15, 20]) {
      const s = composeSession({ ...base, minutes })
      const spent = s.items.reduce((n, i) => n + i.movement.costSeconds, 0)
      expect(spent).toBeLessThanOrEqual(minutes * 60 - 60)
    }
  })

  it('动作用完了就停,并报 pool,不重复硬凑', () => {
    const s = composeSession({ ...base, minutes: 20, alone: false })
    const ids = s.items.map((i) => i.movement.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  /* --- 自动模式下不该有"缺口"这回事 --------------------------------- */

  it('自动模式永远不报缺口', () => {
    // 回归:自动模式内部用了一个哨兵上限,结果界面上出现
    // "You asked for 9007199254740991" —— 把内部实现端给了用户。
    for (const minutes of [1, 5, 10, 16, 20]) {
      for (const alone of [true, false]) {
        const s = composeSession({ ...base, minutes, alone })
        expect(s.shortfall).toBe('none')
      }
    }
  })

  it('自动模式下 wanted 等于实际给的数量,不是哨兵值', () => {
    const s = composeSession({ ...base, minutes: 10 })
    expect(s.wanted).toBe(s.items.length)
    expect(s.wanted).toBeLessThan(100)
  })

  it('"还能再加一个吗":自己限制了数量就还能加', () => {
    // 这个字段是用来回答界面上那句话的:时间还有富余时,
    // 该说"拖一下数量"还是"库里没别的了"。
    const capped = composeSession({ ...base, minutes: 20, maxItems: 3, alone: true })
    expect(capped.poolExhausted).toBe(false)   // 是你自己限制的,拖一下就能多做
  })

  it('"还能再加一个吗":自动模式填到塞不下为止', () => {
    const auto = composeSession({ ...base, minutes: 20, alone: false })
    expect(auto.poolExhausted).toBe(true)      // 已经填满,拖了也没用
  })

  it('一个人时能排出的比有人在场时多', () => {
    const few = composeSession({ ...base, minutes: 20, alone: false })
    const many = composeSession({ ...base, minutes: 20, alone: true })
    expect(many.items.length).toBeGreaterThan(few.items.length)
  })

  /* --- 时长上限要和实际排得出来的长度一致 ----------------------------- */

  it('上限内选满时,剩下的时间不超过一个动作的长度', () => {
    // 回归:滑块固定给到二十分钟,但有人在场只排得出十分钟,
    // 于是允许你选二十、再回头道歉说"剩十分钟"。承诺给不出来的数字不如不承诺。
    for (const alone of [true, false]) {
      const ctx = { sore: [], energy: 'ok' as const, alone }
      const max = maxSessionMinutes(ctx)
      const s = composeSession({ ...ctx, minutes: max })
      expect(max - s.estimatedMinutes).toBeLessThanOrEqual(2)
    }
  })

  it('一个人时上限更长 —— 这正是这个数字该传达的信息', () => {
    const ctx = { sore: [], energy: 'ok' as const }
    expect(maxSessionMinutes({ ...ctx, alone: true }))
      .toBeGreaterThan(maxSessionMinutes({ ...ctx, alone: false }))
  })

  it('标了很多酸痛时上限会缩短', () => {
    const ctx = { energy: 'ok' as const, alone: true }
    const healthy = maxSessionMinutes({ ...ctx, sore: [] })
    const achy = maxSessionMinutes({ ...ctx, sore: ['shoulder', 'back', 'hip', 'knee'] })
    expect(achy).toBeLessThan(healthy)
  })

  it('上限至少是 1,不会给出 0 分钟', () => {
    const ctx = {
      energy: 'ok' as const, alone: false,
      sore: ['neck', 'shoulder', 'back', 'hip', 'knee', 'ankle', 'wrist'] as const,
    }
    expect(maxSessionMinutes({ ...ctx, sore: [...ctx.sore] })).toBeGreaterThanOrEqual(1)
  })

  /* --- 全链路走查发现的三个问题 ------------------------------------- */

  it('"多给时间能解决"才报 time,否则报 pool', () => {
    // 回归:安静模式要十一个、不重复的只有十个,却报"十分钟里只放得下十个",
    // 让人去加时间 —— 加了也没用,卡住的是去重规则。
    const quiet = { ...base, alone: false }
    const max = maxSessionMinutes(quiet)
    const s = composeSession({ ...quiet, minutes: max, maxItems: 30 })
    expect(s.shortfall).toBe('pool')

    // 时间真的不够时仍然报 time
    const squeezed = composeSession({ ...quiet, minutes: 3, maxItems: 6 })
    expect(squeezed.shortfall).toBe('time')
  })

  it('低精力时每个动作的理由不能全一样', () => {
    const s = composeSession({ ...base, minutes: 10, energy: 'low' })
    expect(s.items.length).toBeGreaterThan(3)
    expect(new Set(s.items.map((i) => i.reason)).size).toBeGreaterThan(1)
  })

  it('低精力只给活动度,但说法随动作变', () => {
    const s = composeSession({ ...base, minutes: 10, energy: 'low' })
    const timed = s.items.filter((i) => i.movement.seconds != null)
    const repped = s.items.filter((i) => i.movement.reps != null)
    if (timed.length && repped.length) {
      expect(timed[0].reason).not.toBe(repped[0].reason)
    }
  })

  it('滑块上限回灌进去必须装得下整节课', () => {
    // 回归:上限用取整后的分钟算,耗时 550 秒报 10 分钟,
    // 但 10 分钟的预算只有 540 秒 —— 拉到头仍然少一个动作。
    for (const alone of [true, false]) {
      for (const energy of ['low', 'ok'] as const) {
        const ctx = { sore: [], energy, alone }
        const max = maxSessionMinutes(ctx)
        const atMax = composeSession({ ...ctx, minutes: max })
        const uncapped = composeSession({ ...ctx, minutes: 60 })
        expect(atMax.items.length).toBe(uncapped.items.length)
      }
    }
  })

  /* --- 每个选项都必须真的改变结果 ----------------------------------- */

  it('两个精力档给出不同的课', () => {
    // 回归:原来是 low/ok/good 三档,ok 和 good 给的课一字不差 ——
    // 三选一里有两个相同,那是假选择。删掉一个之后这条守住剩下两个确实不同。
    const low = composeSession({ ...base, minutes: 12, energy: 'low' })
    const ok = composeSession({ ...base, minutes: 12, energy: 'ok' })
    expect(low.items.map((i) => i.movement.id)).not.toEqual(ok.items.map((i) => i.movement.id))
  })

  it('动作库里每一个都穿着上班衣服做得了 —— 这是入选门槛,不是筛选条件', () => {
    // 原来每个动作带 workClothes/noise/space 三个字段,但全库取值一致,
    // 字段不区分任何东西,只是把"每条都满足"重复二十遍。
    // 唯一的例外(跪姿拉伸)和"穿你身上的衣服做"冲突,已经删掉。
    // 这条守住:别再往库里加做不到的动作。
    expect(MOVEMENTS.length).toBeGreaterThan(15)
    for (const m of MOVEMENTS) {
      expect(m.cues).toHaveLength(2)
      expect(m.stopIf.length).toBeGreaterThan(10)
      expect(m.reps != null || m.seconds != null).toBe(true)
    }
  })
})
