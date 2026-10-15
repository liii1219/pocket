/**
 * rigs — 每个动作的三维起止姿势。
 * 单独一个文件,是为了让 MovementDiagram 不用 import three.js 就能判断
 * "这个动作有没有三维版本" —— 否则懒加载就没意义了。
 */

/** 一组关节角度(弧度)。缺的默认 0。 */
export interface Rig {
  /** 整体升降,用来表现下蹲/提踵 */
  rootY?: number
  /** 整体前后倾(靠墙俯卧撑、坐姿后仰) */
  rootX?: number
  /** 躯干相对骨盆:髋铰链就是这个 */
  spineX?: number
  /** 躯干扭转:坐姿转体 */
  spineY?: number
  /** 头:侧倾 */
  headZ?: number
  /** 大腿前摆。负值向前 */
  hipX?: number
  hipLX?: number
  hipRX?: number
  /** 膝屈。正值小腿后折 */
  kneeX?: number
  kneeLX?: number
  kneeRX?: number
  /** 上臂前摆。负值向前,-2.9 约等于举过头顶 */
  shoulderX?: number
  /** 肘屈 */
  elbowX?: number
  /** 踝,用来做提踵 */
  ankleX?: number
  ankleLX?: number
  ankleRX?: number
  /** 肩膀整体上下。耸肩用,负值向上 */
  shoulderY?: number
  /** 上臂外展(绕 Z)。侧平举用,正值向外抬起 */
  shoulderZ?: number
  /** 躯干侧倾。坐姿侧弯用 */
  spineZ?: number
  /** 头前后移。缩下巴用,负值后缩 */
  headZpos?: number
}

export interface Frames {
  a: Rig
  b: Rig
  labelA: string
  labelB: string
}

/**
 * 每个动作的起止姿势。
 * 符号约定:绕 X 轴负值把肢体向前摆(镜头在 +Z),正值向后。
 */
export const RIGS: Record<string, Frames> = {
  'reach-dots': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, shoulderZ: 0.4 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, shoulderZ: 2.0, shoulderX: -0.5 },
    labelA: 'Hands down', labelB: 'Reach out',
  },
  'shoulder-shrug': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, shoulderY: -0.1 },
    labelA: 'Relaxed', labelB: 'Up to the ears',
  },
  'lateral-raise': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, shoulderZ: 1.5 },
    labelA: 'Arms down', labelB: 'Shoulder height',
  },
  'side-bend': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, spineZ: 0.42, shoulderZ: 0.5 },
    labelA: 'Sit tall', labelB: 'Reach long',
  },
  'scap-squeeze': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, shoulderX: -0.5, elbowX: 1.1 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, shoulderX: -0.1, elbowX: 1.5 },
    labelA: 'Elbows forward', labelB: 'Blades together',
  },
  'seated-march': {
    a: { rootY: -0.45, hipLX: -1.5, kneeLX: 1.5, hipRX: -1.5, kneeRX: 1.5 },
    b: { rootY: -0.45, hipLX: -2.1, kneeLX: 1.3, hipRX: -1.5, kneeRX: 1.5 },
    labelA: 'Both feet down', labelB: 'Lift one knee',
  },
  'ankle-circles': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, ankleLX: -0.5 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, ankleLX: 0.6 },
    labelA: 'Toes up', labelB: 'Toes down',
  },
  'chin-tuck': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, headZpos: 0.07 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, headZpos: -0.03 },
    labelA: 'Chin forward', labelB: 'Chin back',
  },
  'glute-squeeze': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5 },
    b: { rootY: -0.42, hipX: -1.55, kneeX: 1.5, spineX: 0.08 },
    labelA: 'Sit normally', labelB: 'Squeeze and lift',
  },
  'chair-squat': {
    a: {},
    b: { rootY: -0.38, hipX: -1.35, kneeX: 1.55, spineX: -0.45, shoulderX: -1.4 },
    labelA: 'Stand', labelB: 'Sit back',
  },
  'hip-hinge': {
    a: {},
    b: { spineX: -1.15, kneeX: 0.25, rootY: -0.05, shoulderX: -0.1 },
    labelA: 'Tall', labelB: 'Hips back',
  },
  'wall-push': {
    a: { rootX: -0.22, shoulderX: -1.55, elbowX: 0.05 },
    b: { rootX: -0.34, shoulderX: -1.5, elbowX: 1.15 },
    labelA: 'Arms long', labelB: 'Chest to wall',
  },
  'desk-row': {
    a: { rootX: 0.16, shoulderX: -1.5, elbowX: 0.2 },
    b: { rootX: 0.12, shoulderX: -0.65, elbowX: 1.6 },
    labelA: 'Lean back', labelB: 'Pull',
  },
  'shoulder-openers': {
    a: {},
    b: { shoulderX: -2.85 },
    labelA: 'Down', labelB: 'Overhead',
  },
  'neck-release': {
    a: {},
    b: { headZ: 0.5 },
    labelA: 'Neutral', labelB: 'Ear to shoulder',
  },
  'hip-flexor-stretch': {
    a: { rootY: -0.42, hipLX: -1.5, kneeLX: 1.5, hipRX: 0.35, kneeRX: 1.6 },
    b: { rootY: -0.34, hipLX: -1.2, kneeLX: 1.3, hipRX: 0.6, kneeRX: 1.6, spineX: 0.12 },
    labelA: 'Kneel', labelB: 'Hips forward',
  },
  'calf-raise': {
    a: {},
    b: { rootY: 0.1, ankleX: -0.4 },
    labelA: 'Flat', labelB: 'Up on toes',
  },
  'seated-twist': {
    a: { rootY: -0.45, hipX: -1.5, kneeX: 1.5 },
    b: { rootY: -0.45, hipX: -1.5, kneeX: 1.5, spineY: 0.75, shoulderX: -0.5 },
    labelA: 'Sit tall', labelB: 'Turn',
  },
}

