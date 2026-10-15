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

import { angleDeg, framingHint, headTiltDeg, insideFrame, LM, mid, tiltFromVerticalDeg, torsoTwistDeg, visibleEnough, type Landmark } from './angles'

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
export function checkSquat(lms: Landmark[], state: CheckState, t: number, world?: Landmark[],
): CheckOutput {
  if (!visibleEnough(lms, SQUAT_IDX) || !insideFrame(lms, SQUAT_IDX)) {
    return { ...state, ...NOT_VISIBLE, cue: framingHint(lms, SQUAT_IDX) }
  }
  // 画面坐标只用来判"看不看得见"。角度一律用 world(米制三维),否则机位一变角度就偏。
  const W = world ?? lms
  const hip = mid(W[LM.leftHip], W[LM.rightHip])
  const knee = mid(W[LM.leftKnee], W[LM.rightKnee])
  const ankle = mid(W[LM.leftAnkle], W[LM.rightAnkle])
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
export function checkHinge(lms: Landmark[], state: CheckState, t: number, world?: Landmark[],
): CheckOutput {
  if (!visibleEnough(lms, HINGE_IDX) || !insideFrame(lms, HINGE_IDX)) {
    return { ...state, ...NOT_VISIBLE, cue: framingHint(lms, HINGE_IDX) }
  }
  const W = world ?? lms
  const shoulder = mid(W[LM.leftShoulder], W[LM.rightShoulder])
  const hip = mid(W[LM.leftHip], W[LM.rightHip])
  const knee = mid(W[LM.leftKnee], W[LM.rightKnee])
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
export function checkShoulder(lms: Landmark[], state: CheckState, t: number, world?: Landmark[],
): CheckOutput {
  if (!visibleEnough(lms, SHOULDER_IDX)) return { ...state, ...NOT_VISIBLE, cue: framingHint(lms, SHOULDER_IDX) }
  const W = world ?? lms
  const hip = mid(W[LM.leftHip], W[LM.rightHip])
  const shoulder = mid(W[LM.leftShoulder], W[LM.rightShoulder])
  const elbow = mid(W[LM.leftElbow], W[LM.rightElbow])
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


/* ------------------------------------------------- 只用上半身的三个判定器 */

/**
 * 这三个只看肩、肘、腕、耳 —— 笔记本摄像头在桌前**一定**拍得到的那部分。
 * 深蹲和髋铰链需要膝和踝,人坐在桌前时根本不在画面里(用户测试里就卡在这)。
 * 所以要让"周围有人"那条线也能用上摄像头,判定器必须只依赖上半身。
 */

/** 肩-肘-腕夹角。伸直约 170°,弯到底约 70°。靠墙俯卧撑和划船都用它。 */
const ELBOW_IDX = [LM.leftShoulder, LM.rightShoulder, LM.leftElbow, LM.rightElbow, LM.leftWrist, LM.rightWrist]
const ELBOW_TH: Thresholds = { down: 125, up: 155, depth: 100, minMs: 1100 }

export function checkElbow(
  lms: Landmark[],
  state: CheckState,
  t: number,
  world?: Landmark[],
): CheckOutput {
  if (!visibleEnough(lms, ELBOW_IDX)) {
    return { ...state, ...NOT_VISIBLE, cue: framingHint(lms, ELBOW_IDX) }
  }
  const W = world ?? lms
  const shoulder = mid(W[LM.leftShoulder], W[LM.rightShoulder])
  const elbow = mid(W[LM.leftElbow], W[LM.rightElbow])
  const wrist = mid(W[LM.leftWrist], W[LM.rightWrist])
  const angle = angleDeg(shoulder, elbow, wrist)
  if (Number.isNaN(angle)) return { ...state, ...NOT_VISIBLE }

  const s = { ...state }
  const { counted, repMinAngle } = advance(s, angle, t, ELBOW_TH)
  const cue = counted
    ? pickCue(s, repMinAngle, ELBOW_TH, 'Bend the elbows further next time.', 'Slower on the way down.')
    : null
  return { ...s, confident: true, cue, angle, counted }
}

/**
 * 头侧倾。耳朵往肩膀靠,到位再回正算一次。
 * 🔴 倾角是**越大越好**,和深蹲相反,所以喂给状态机的是 180 - tilt。
 */
const NECK_IDX = [LM.leftEar, LM.rightEar, LM.leftShoulder, LM.rightShoulder]
const NECK_TH: Thresholds = { down: 165, up: 173, depth: 158, minMs: 1500 }

export function checkNeckTilt(lms: Landmark[], state: CheckState, t: number): CheckOutput {
  if (!visibleEnough(lms, NECK_IDX)) {
    return { ...state, ...NOT_VISIBLE, cue: framingHint(lms, NECK_IDX) }
  }
  const tilt = headTiltDeg(lms)
  if (Number.isNaN(tilt)) return { ...state, ...NOT_VISIBLE }
  const inverted = 180 - tilt

  const s = { ...state }
  const { counted, repMinAngle } = advance(s, inverted, t, NECK_TH)
  const cue = counted
    ? pickCue(s, repMinAngle, NECK_TH, 'Let the ear travel further towards the shoulder.', 'Ease into it, do not snap.')
    : null
  return { ...s, confident: true, cue, angle: Math.round(tilt), counted }
}

/**
 * 躯干扭转。正对镜头坐好,转到一侧再回正算一次。
 * 需要 world 坐标:判的是肩膀连线在水平面上转了多少,画面坐标算不出来。
 */
const TWIST_IDX = [LM.leftShoulder, LM.rightShoulder]
const TWIST_TH: Thresholds = { down: 155, up: 170, depth: 145, minMs: 1500 }

export function checkTwist(
  lms: Landmark[],
  state: CheckState,
  t: number,
  world?: Landmark[],
): CheckOutput {
  if (!visibleEnough(lms, TWIST_IDX)) {
    return { ...state, ...NOT_VISIBLE, cue: framingHint(lms, TWIST_IDX) }
  }
  if (!world) {
    return { ...state, confident: false, cue: 'Turning needs the 3D view, which is not ready yet.', angle: null, counted: false }
  }
  const twist = torsoTwistDeg(world)
  if (Number.isNaN(twist)) return { ...state, ...NOT_VISIBLE }
  const inverted = 180 - twist

  const s = { ...state }
  const { counted, repMinAngle } = advance(s, inverted, t, TWIST_TH)
  const cue = counted
    ? pickCue(s, repMinAngle, TWIST_TH, 'Turn a little further through the ribs.', 'Slower, and keep sitting tall.')
    : null
  return { ...s, confident: true, cue, angle: Math.round(twist), counted }
}

export type CheckerId =
  | 'squat-depth'
  | 'hinge-back'
  | 'shoulder-range'
  | 'elbow-bend'
  | 'neck-tilt'
  | 'torso-twist'

/**
 * 判定函数签名。
 * lms   画面归一化坐标 —— 只用来判"看不看得见""在不在画面里"
 * world 米制三维坐标 —— 角度一律用它,与机位无关。省略时退回用 lms(测试里这么用)
 */
export type PoseChecker = (
  lms: Landmark[],
  state: CheckState,
  t: number,
  world?: Landmark[],
) => CheckOutput

export const CHECKERS: Record<CheckerId, PoseChecker> = {
  'squat-depth': checkSquat,
  'hinge-back': checkHinge,
  'shoulder-range': checkShoulder,
  'elbow-bend': checkElbow,
  'neck-tilt': checkNeckTilt,
  'torso-twist': checkTwist,
}
