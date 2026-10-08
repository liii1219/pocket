/**
 * checkers — 动作判定器【纯状态机】。喂关键点 + 时间戳,吐次数和最多一条提示。
 *
 * 三条设计规则(直接来自访谈,不是随便定的):
 * 1. 一次只给一条提示。同时说三件事等于什么都没说。
 * 2. 看不清就说看不清(confident=false),绝不猜。用户宁可没反馈,也不要错反馈。
 * 3. 只在一次动作【做完】时说话,过程中不打断。
 *
 * ⚠️ 能力边界(报告里必须写):2D 关键点里没有腰椎,只有肩和髋两个点。
 *    所以这里能判"躯干整体角度",判不了"腰有没有塌"。
 *    真正的塌腰判定需要深度相机或腰部惯性传感器。
 */

import { angleDeg, insideFrame, LM, mid, tiltFromVerticalDeg, visibleEnough, type Landmark } from './angles'

export type Phase = 'up' | 'down'

export interface CheckState {
  reps: number
  phase: Phase
  /** 本次下潜过程中的最小主角度(越小越深)。回到 up 时结算并重置。 */
  minAngle: number
  /** 本次下潜开始的时间戳(ms)。用来算单次耗时,判断是不是甩。 */
  downStartT: number
  /** 上一次完整动作的耗时(ms),0 表示还没有 */
  lastRepMs: number
  /** 这一组里出现过的问题,用于避免同一句话反复说 */
  flags: string[]
}

export interface CheckOutput extends CheckState {
  confident: boolean
  /** 最多一条,没有就是 null */
  cue: string | null
  /** 当前主角度,调试和教学用 */
  angle: number | null
  /** 这一帧是不是刚好数完一次 */
  counted: boolean
}

export function initState(): CheckState {
  return { reps: 0, phase: 'up', minAngle: 180, downStartT: 0, lastRepMs: 0, flags: [] }
}

/** 迟滞阈值:进下位和回上位用不同门槛,避免在临界点反复跳数。 */
interface Thresholds {
  down: number
  up: number
  /** 够深的标准:最小角要小于这个值 */
  depth: number
  /** 太快的标准:单次快于这个毫秒数就是甩 */
  minMs: number
}

const NOT_VISIBLE = {
  confident: false as const,
  cue: 'I cannot see you well enough to check this.',
  angle: null,
  counted: false as const,
}

/**
 * 通用的下潜-回位状态机。
 * @returns counted 这一帧是否刚数完一次;repMinAngle 该次的最小角(仅 counted 时有意义)
 */
function advance(
  s: CheckState,
  angle: number,
  t: number,
  th: Thresholds,
): { counted: boolean; repMinAngle: number } {
  if (s.phase === 'up') {
    if (angle <= th.down) {
      s.phase = 'down'
      s.minAngle = angle
      s.downStartT = t
    }
    return { counted: false, repMinAngle: 180 }
  }
  // phase === 'down'
  if (angle < s.minAngle) s.minAngle = angle
  if (angle >= th.up) {
    const repMin = s.minAngle
    s.phase = 'up'
    s.reps += 1
    s.lastRepMs = s.downStartT > 0 ? t - s.downStartT : 0
    s.minAngle = 180
    return { counted: true, repMinAngle: repMin }
  }
  return { counted: false, repMinAngle: 180 }
}

/** 一次只挑一条最该说的话:安全 > 幅度 > 节奏。 */
function pickCue(s: CheckState, repMin: number, th: Thresholds, tooShallow: string, tooFast: string): string | null {
  if (repMin > th.depth) {
    if (!s.flags.includes('depth')) s.flags.push('depth')
    return tooShallow
  }
  if (s.lastRepMs > 0 && s.lastRepMs < th.minMs) {
    if (!s.flags.includes('tempo')) s.flags.push('tempo')
    return tooFast
  }
  // 之前提过深度,这次到位了 → 给一次确认就够,别一直夸
  if (s.flags.includes('depth')) {
    s.flags = s.flags.filter((f) => f !== 'depth')
    return 'That one was deep enough.'
  }
  return null
}

/* ---------------------------------------------------------------- squat */

const SQUAT_IDX = [LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee, LM.leftAnkle, LM.rightAnkle]
const SQUAT_TH: Thresholds = { down: 140, up: 160, depth: 110, minMs: 1200 }

/**
 * 深蹲:髋-膝-踝夹角。侧面或斜 45° 拍最准。
 * 判两件事:蹲得够不够深(该次最小膝角)、是不是甩(单次耗时)。
 */
export function checkSquat(lms: Landmark[], state: CheckState, t: number): CheckOutput {
  if (!visibleEnough(lms, SQUAT_IDX) || !insideFrame(lms, SQUAT_IDX)) {
    return { ...state, ...NOT_VISIBLE }
  }
  const hip = mid(lms[LM.leftHip], lms[LM.rightHip])
  const knee = mid(lms[LM.leftKnee], lms[LM.rightKnee])
  const ankle = mid(lms[LM.leftAnkle], lms[LM.rightAnkle])
  const angle = angleDeg(hip, knee, ankle)
  if (!Number.isFinite(angle)) return { ...state, ...NOT_VISIBLE }

  const { counted, repMinAngle } = advance(state, angle, t, SQUAT_TH)
  const cue = counted
    ? pickCue(state, repMinAngle, SQUAT_TH, 'Sit a little lower next time.', 'Slower on the way down.')
    : null

  return { ...state, confident: true, cue, angle, counted }
}

/* ---------------------------------------------------------------- hinge */

const HINGE_IDX = [LM.leftShoulder, LM.rightShoulder, LM.leftHip, LM.rightHip, LM.leftKnee, LM.rightKnee]
const HINGE_TH: Thresholds = { down: 140, up: 165, depth: 120, minMs: 1200 }

/**
 * 髋铰链:肩-髋-膝夹角数次数,躯干倾角区分"推髋"和"屈膝"。
 * ⚠️ 判不了塌腰,见文件头说明。
 */
export function checkHinge(lms: Landmark[], state: CheckState, t: number): CheckOutput {
  if (!visibleEnough(lms, HINGE_IDX) || !insideFrame(lms, HINGE_IDX)) {
    return { ...state, ...NOT_VISIBLE }
  }
  const shoulder = mid(lms[LM.leftShoulder], lms[LM.rightShoulder])
  const hip = mid(lms[LM.leftHip], lms[LM.rightHip])
  const knee = mid(lms[LM.leftKnee], lms[LM.rightKnee])
  const angle = angleDeg(shoulder, hip, knee)
  if (!Number.isFinite(angle)) return { ...state, ...NOT_VISIBLE }

  const torsoTilt = tiltFromVerticalDeg(shoulder, hip)
  const { counted, repMinAngle } = advance(state, angle, t, HINGE_TH)

  // 躯干几乎还立着却已经进了下位 → 是屈膝下蹲,不是铰链。这条比幅度更重要,优先说。
  if (state.phase === 'down' && torsoTilt < 20) {
    if (!state.flags.includes('hips')) state.flags.push('hips')
    return { ...state, confident: true, cue: 'Push your hips back, not down.', angle, counted }
  }

  const cue = counted
    ? pickCue(state, repMinAngle, HINGE_TH, 'Reach a bit further back.', 'Slower, feel the hamstrings.')
    : null

  return { ...state, confident: true, cue, angle, counted }
}

/* ------------------------------------------------------------- shoulder */

const SHOULDER_IDX = [LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow, LM.leftHip, LM.rightHip]

/**
 * 肩活动度:髋-肩-肘夹角(手臂相对躯干抬起的角度)。
 * 这里的"下位"借用为"举到顶",所以阈值方向和上面两个相反。
 */
export function checkShoulder(lms: Landmark[], state: CheckState, t: number): CheckOutput {
  if (!visibleEnough(lms, SHOULDER_IDX)) return { ...state, ...NOT_VISIBLE }
  const hip = mid(lms[LM.leftHip], lms[LM.rightHip])
  const shoulder = mid(lms[LM.leftShoulder], lms[LM.rightShoulder])
  const elbow = mid(lms[LM.leftElbow], lms[LM.rightElbow])
  const angle = angleDeg(hip, shoulder, elbow)
  if (!Number.isFinite(angle)) return { ...state, ...NOT_VISIBLE }

  let counted = false
  let cue: string | null = null

  if (state.phase === 'up' && angle >= 140) {
    state.phase = 'down' // 到顶
    state.downStartT = t
    state.minAngle = angle
  } else if (state.phase === 'down') {
    if (angle > state.minAngle) state.minAngle = angle // 这里记的是最大值
    if (angle <= 60) {
      state.phase = 'up'
      state.reps += 1
      counted = true
      if (state.minAngle < 155 && !state.flags.includes('range')) {
        state.flags.push('range')
        cue = 'Try to reach a little higher.'
      }
      state.minAngle = 180
    }
  }

  return { ...state, confident: true, cue, angle, counted }
}

export type CheckerId = 'squat-depth' | 'hinge-back' | 'shoulder-range'

export const CHECKERS: Record<CheckerId, (lms: Landmark[], s: CheckState, t: number) => CheckOutput> = {
  'squat-depth': checkSquat,
  'hinge-back': checkHinge,
  'shoulder-range': checkShoulder,
}
