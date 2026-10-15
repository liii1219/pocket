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
}

export interface SessionItem {
  movement: Movement
  /** 一句话交代为什么是这个动作 */
  reason: string
}

export interface Session {
  items: SessionItem[]
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

  // 排序而非随机:先给有摄像头判定的(用户能拿到反馈),再按耗时从小到大,让短空档也能装下几个
  const ordered = [...pool].sort((a, b) => {
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
    if (items.length >= 6) break
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
      if (items.length >= 6) break
      if (taken.has(m.id)) continue
      if (spent + m.costSeconds > budget) continue
      add(m)
    }
  }

  return {
    items,
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
