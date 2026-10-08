/**
 * movements — 动作库【纯数据 + 纯查询】。
 *
 * 收录标准(每一条都是设计约束,不是随便填的):
 * - workClothes: 穿上班的衣服能不能做。不能的一律排除在"办公桌空档"之外。
 * - noise: 'quiet' 才能进合租房和办公室;'any' 只在家里或健身房出现。
 * - space: 需要多少地面。'none' = 站着或坐着就行。
 * - poseCheck: 有没有对应的摄像头判定器。没有的动作不会假装能检查。
 */

export type Place = 'desk' | 'floor' | 'gym'
export type BodyArea = 'neck' | 'shoulder' | 'back' | 'hip' | 'knee' | 'ankle' | 'wrist'
export type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'mobility' | 'carry'
export type PoseCheckId = 'squat-depth' | 'hinge-back' | 'shoulder-range'

export interface Movement {
  id: string
  name: string
  /** 最多两个提示词 —— 屏幕上一次只显示这两个 */
  cues: [string, string]
  pattern: Pattern
  places: Place[]
  noise: 'quiet' | 'any'
  space: 'none' | 'small'
  workClothes: boolean
  /** 这个动作主要压到哪些部位。用户报了酸痛就避开。 */
  loads: BodyArea[]
  /** 单组默认剂量 */
  reps?: number
  seconds?: number
  /** 做完一组大约要多久(秒),含组间休息 —— 用来给空档排预算 */
  costSeconds: number
  poseCheck?: PoseCheckId
  /** 出事的信号,原样显示给用户 */
  stopIf: string
}

export const MOVEMENTS: Movement[] = [
  {
    id: 'chair-squat',
    name: 'Chair squat',
    cues: ['Sit back', 'Chest up'],
    pattern: 'squat',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['knee', 'hip'],
    reps: 10,
    costSeconds: 70,
    poseCheck: 'squat-depth',
    stopIf: 'Stop if your knees hurt at the bottom.',
  },
  {
    id: 'hip-hinge',
    name: 'Standing hip hinge',
    cues: ['Push hips back', 'Flat back'],
    pattern: 'hinge',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['back', 'hip'],
    reps: 8,
    costSeconds: 70,
    poseCheck: 'hinge-back',
    stopIf: 'Stop the moment your lower back rounds or aches.',
  },
  {
    id: 'wall-push',
    name: 'Wall push-up',
    cues: ['Elbows in', 'Body in a line'],
    pattern: 'push',
    places: ['desk', 'floor'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['shoulder', 'wrist'],
    reps: 10,
    costSeconds: 70,
    poseCheck: undefined,
    stopIf: 'Stop if your wrists or shoulders pinch.',
  },
  {
    id: 'desk-row',
    name: 'Doorway row',
    cues: ['Squeeze shoulder blades', 'Slow return'],
    pattern: 'pull',
    places: ['desk', 'floor'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['back', 'shoulder'],
    reps: 10,
    costSeconds: 75,
    stopIf: 'Stop if your shoulder catches.',
  },
  {
    id: 'shoulder-openers',
    name: 'Shoulder openers',
    cues: ['Slow', 'Full range'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['shoulder'],
    seconds: 40,
    costSeconds: 55,
    poseCheck: 'shoulder-range',
    stopIf: 'Stop if it pinches at the top.',
  },
  {
    id: 'neck-release',
    name: 'Neck release',
    cues: ['Ear to shoulder', 'Breathe out'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['neck'],
    seconds: 40,
    costSeconds: 50,
    stopIf: 'Stop if anything shoots down your arm.',
  },
  {
    id: 'hip-flexor-stretch',
    name: 'Half-kneeling hip stretch',
    cues: ['Tuck the tail', 'Stand tall'],
    pattern: 'mobility',
    places: ['floor', 'gym'],
    noise: 'quiet',
    space: 'small',
    workClothes: false,
    loads: ['hip', 'knee'],
    seconds: 60,
    costSeconds: 75,
    stopIf: 'Stop if your knee hurts on the floor.',
  },
  {
    id: 'calf-raise',
    name: 'Calf raise',
    cues: ['Up slow', 'Down slower'],
    pattern: 'carry',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['ankle'],
    reps: 15,
    costSeconds: 60,
    stopIf: 'Stop if your achilles stings.',
  },
]

export function byId(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id)
}

/** 这个动作在这个场合能不能做。🔴 只做排除,不做打分 —— 打分在 session 层。 */
export function isAllowed(m: Movement, place: Place, sore: BodyArea[], quietOnly: boolean): boolean {
  if (!m.places.includes(place)) return false
  if (place === 'desk' && !m.workClothes) return false
  if (quietOnly && m.noise !== 'quiet') return false
  // 🔴 酸痛 ≠ 不能动。区别在于是"加负荷"还是"活动开":
  //   力量/负重动作压到酸痛部位  → 排除
  //   活动度动作针对酸痛部位      → 恰恰是该做的,保留
  // 一刀切会把 Shoulder openers 这种专门给肩膀做的动作也排掉,
  // 结果用户标得越诚实,拿到的动作越少 —— 这是在惩罚认真填的人。
  if (m.pattern !== 'mobility' && m.loads.some((a) => sore.includes(a))) return false
  return true
}

/** 这个动作是不是"专门给某个酸痛部位做的活动度动作"。用来给用户解释为什么它还在。 */
export function targetsSoreArea(m: Movement, sore: BodyArea[]): BodyArea[] {
  if (m.pattern !== 'mobility') return []
  return m.loads.filter((a) => sore.includes(a))
}
