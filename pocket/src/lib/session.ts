/**
 * session — 把"一个空档 + 当下状态"编成一节课【纯函数】。
 *
 * 三条硬规则:
 * 1. 用户不做选择。输入是状态(时间/酸痛/地点/精力),输出是一个已经定好的课。
 * 2. 每个动作必须能说出为什么被选中(reason),否则不放进来 —— 用户要能检查系统的逻辑。
 * 3. 排不满就排不满。宁可给三个动作,不硬凑到把空档填死。
 */

import { isAllowed, MOVEMENTS, targetsSoreArea, type BodyArea, type Movement, type Place } from './movements'

export type Energy = 'low' | 'ok' | 'good'

export interface SessionInput {
  /** 空档剩余分钟 */
  minutes: number
  place: Place
  sore: BodyArea[]
  energy: Energy
  /** 合租/办公室等不能出声的场合 */
  quietOnly: boolean
  /** 周围没人。false 时只给看不出来是在运动的动作 */
  alone: boolean
  /** 最多几个动作。不给就按时间自己定 */
  maxItems?: number
}

export interface SessionItem {
  movement: Movement
  /** 一句话交代为什么是这个动作 */
  reason: string
}

/**
 * 为什么没排满。
 * 用户自己填数量之后,"要五个只给了三个"必须说清楚原因 ——
 * 是时间不够,还是安静的动作本来就只有这么多。默默少给等于骗人。
 */
export type Shortfall = 'none' | 'time' | 'pool'

export interface Session {
  items: SessionItem[]
  /** 想要的数量没满足时,是什么限制住了 */
  shortfall: Shortfall
  /** 用户要的数量(没指定就是自动算的那个) */
  wanted: number
  /** 预计耗时(分钟,向上取整) */
  estimatedMinutes: number
  /** 整节课的一句话说明,显示在最上面 */
  headline: string
}

/** 留出 1 分钟缓冲:空档到点前要能收尾,不能压着下一件事。 */
const BUFFER_SECONDS = 60

/** 低精力时的动作顺位:只给活动度,不给发力。 */
const LOW_ENERGY_PATTERNS = new Set(['mobility'])

/**
 * 为什么是这个动作。
 * 🔴 顺序是有意的:先说这个动作**自己**的理由,再退回泛用理由。
 * 否则一节课里六张卡片会显示同一句话,等于没解释。
 */
function reasonFor(m: Movement, input: SessionInput): string {
  const targeted = targetsSoreArea(m, input.sore)
  if (targeted.length > 0) {
    return `Gentle movement for the ${targeted.join(' and ')} you marked sore. It does not load it.`
  }
  if (input.energy === 'low' && m.pattern === 'mobility') {
    return 'You said your energy is low, so this is mobility rather than effort.'
  }
  if (m.poseCheck) {
    return 'The camera can check this one, so you get feedback on the shape.'
  }
  // 放在动作各自的理由之后:否则"有人在场"模式下六张卡片会显示同一句话
  if (!input.alone) {
    return m.seconds
      ? 'Done sitting or standing still. It reads as a stretch, not a workout.'
      : 'Small enough that nobody looks up.'
  }
  if (input.sore.length > 0) {
    return `Nothing in this one loads the areas you marked sore.`
  }
  if (input.place === 'desk') {
    return 'Done standing at the desk, in the clothes you are already wearing.'
  }
  return `Fits ${input.minutes} minutes and needs no equipment.`
}

/**
 * 编一节课。
 * 🔴 不随机:同样的输入永远得到同样的输出(可复现,方便课堂演示和测试)。
 */
export function composeSession(input: SessionInput): Session {
  const budget = Math.max(0, input.minutes * 60 - BUFFER_SECONDS)

  let pool = MOVEMENTS.filter((m) => isAllowed(m, input.place, input.sore, input.quietOnly, input.alone))

  if (input.energy === 'low') {
    const soft = pool.filter((m) => LOW_ENERGY_PATTERNS.has(m.pattern))
    // 低精力时如果活动度动作够,就只用它们;不够就退回全集,不至于给个空课
    if (soft.length >= 2) pool = soft
  }

  /**
   * 排序而非随机,保证可复现。
   *
   * 🔴 一个人的时候把力量动作排在前面。
   * 否则会出现:安静动作大多有判定器又耗时短,六个名额全被它们占掉,
   * "Just me" 和 "People nearby" 给的课几乎一样 —— visibility 这一维就白加了。
   * 有privacy的时候,能做的事就该和被人看着的时候不一样。
   */
  const ordered = [...pool].sort((a, b) => {
    if (input.alone) {
      const byStrength = Number(a.pattern === 'mobility') - Number(b.pattern === 'mobility')
      if (byStrength !== 0) return byStrength
    }
    const byCheck = Number(Boolean(b.poseCheck)) - Number(Boolean(a.poseCheck))
    if (byCheck !== 0) return byCheck
    return a.costSeconds - b.costSeconds
  })

  /**
   * 去重键。
   * 🔴 力量动作按 pattern 去重(别一节课三种深蹲),但 mobility 不能这么去重:
   * 颈、腕、踝、眼睛都是 mobility,它们是不同的身体部位,不是同一件事。
   * 所以 mobility 按**目标部位**去重 —— 两个颈部动作仍然只取一个,
   * 但颈 + 腕 + 踝可以同时出现。
   *
   * 加了六个坐姿动作之后,旧规则反而让课变短了(全挤在四个 pattern 里,上限就是四个)。
   */
  const dedupeKey = (m: Movement) =>
    m.pattern === 'mobility' ? `mobility:${m.loads.join(',')}` : m.pattern

  /**
   * 动作数量上限。
   * 没指定时按时长估:五分钟三四个就满了,二十分钟给到八个。
   * 用户可以自己调 —— 同样十分钟,有人想做八个短的,有人想做四个慢的。
   */
  const cap = input.maxItems ?? Math.max(3, Math.min(8, Math.round(input.minutes * 0.6)))

  const items: SessionItem[] = []
  const usedPatterns = new Set<string>()
  const taken = new Set<string>()
  let spent = 0

  const add = (m: Movement) => {
    items.push({ movement: m, reason: reasonFor(m, input) })
    usedPatterns.add(dedupeKey(m))
    taken.add(m.id)
    spent += m.costSeconds
  }

  // 第一趟:同一个动作模式最多一个,避免一节课全是深蹲
  for (const m of ordered) {
    if (items.length >= cap) break
    if (usedPatterns.has(dedupeKey(m))) continue
    if (spent + m.costSeconds > budget) continue
    add(m)
  }

  // 🔴 第二趟:如果第一趟只排出不到三个,放宽去重再来一次。
  // 触发场景:用户标了很多部位酸痛,力量动作全被排掉,只剩几个 mobility ——
  // 而 mobility 全都是同一个 pattern,第一趟只会放进来一个,用户就只拿到一个动作。
  // 但 Shoulder openers 和 Neck release 根本不是同一件事,它们各管一个部位,不该互相挤掉。
  if (items.length < 3) {
    for (const m of ordered) {
      if (items.length >= cap) break
      if (taken.has(m.id)) continue
      if (spent + m.costSeconds > budget) continue
      add(m)
    }
  }

  /**
   * 没排满的话是什么拦住的?按**根本限制**判,不按表面现象。
   *
   * 要的比符合条件的动作总数还多 → 再多时间也没用,是动作不够(pool)。
   * 否则就是时间不够(time)。
   *
   * 反过来写会出错:要 30 个、库里 18 个、时间刚好差一点塞不下最后两个,
   * 看起来"还有没用上的"就报成时间不够 —— 但真正的原因是库里压根没有 30 个。
   */
  let shortfall: Shortfall = 'none'
  if (items.length < cap) {
    shortfall = cap > ordered.length ? 'pool' : 'time'
  }

  return {
    items,
    shortfall,
    wanted: cap,
    estimatedMinutes: Math.ceil(spent / 60),
    headline: headlineFor(input, items.length),
  }
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function headlineFor(input: SessionInput, count: number): string {
  if (count === 0) return 'Not enough time for anything useful. Take the gap off.'
  const where = input.place === 'desk' ? 'at your desk' : input.place === 'floor' ? 'on the floor' : 'in the gym'
  // 标了很多酸痛时要说清楚课为什么变短了,否则用户只看到"少了"而不知道原因
  if (!input.alone) {
    return `${plural(count, 'quiet movement')} ${where}. Nothing here looks like exercising.`
  }
  if (input.sore.length >= 3) {
    return `${plural(count, 'gentle movement')} ${where}. You marked a lot as sore, so this is mobility only.`
  }
  if (input.energy === 'low') return `${plural(count, 'easy movement')} ${where}. Nothing hard today.`
  return `${plural(count, 'movement')} ${where}, about ${input.minutes} minutes.`
}
