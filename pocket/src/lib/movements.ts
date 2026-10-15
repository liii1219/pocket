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
export type PoseCheckId =
  | 'squat-depth'
  | 'hinge-back'
  | 'shoulder-range'
  | 'elbow-bend'
  | 'neck-tilt'
  | 'torso-twist'
  | 'shoulder-shrug'
  | 'arm-raise'

/**
 * 别人会不会注意到你在运动。
 * 这一维是用户测试逼出来的:受访者说办公室有人时不做显眼的动作,没人时什么都做。
 * 门槛不是办公室、也不是运动本身,是"被看见",而且取决于做哪个动作。
 *
 *   discreet — 看着像在工位上伸懒腰。坐着或站着不动。
 *   obvious  — 看着像在运动。要蹲下、趴下或者大幅度动。
 *
 * 和 noise 是同一类约束:共用办公室既不能吵,也不能显眼。我们之前只解决了一半。
 */
export type Visibility = 'discreet' | 'obvious'

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
  /** 周围有人时能不能做,见 Visibility */
  visibility: Visibility
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
    visibility: 'obvious',
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
    visibility: 'obvious',
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
    visibility: 'obvious',
    reps: 10,
    costSeconds: 70,
    poseCheck: 'elbow-bend',
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
    visibility: 'obvious',
    reps: 10,
    costSeconds: 75,
    poseCheck: 'elbow-bend',
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
    visibility: 'discreet',
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
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 50,
    poseCheck: 'neck-tilt',
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
    visibility: 'obvious',
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
    visibility: 'discreet',
    reps: 15,
    costSeconds: 60,
    stopIf: 'Stop if your achilles stings.',
  },
  {
    id: 'eye-exercises',
    name: 'Eye exercises',
    cues: ['Look far, then near', 'Blink fully'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: [],
    visibility: 'discreet',
    seconds: 60,
    costSeconds: 65,
    stopIf: 'Stop if you get a headache or your vision blurs.',
  },
  {
    id: 'neck-acupressure',
    name: 'Neck pressure points',
    cues: ['Thumbs at the base of the skull', 'Press, hold, release'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['neck'],
    visibility: 'discreet',
    seconds: 45,
    costSeconds: 50,
    stopIf: 'Press firmly, never sharply. Stop if it feels pointed rather than dull.',
  },
  {
    id: 'seated-twist',
    name: 'Seated twist',
    cues: ['Sit tall first', 'Turn from the ribs'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['back'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 45,
    poseCheck: 'torso-twist',
    stopIf: 'Stop if it pinches in the lower back rather than stretching.',
  },
  {
    id: 'wrist-stretch',
    name: 'Wrist and forearm stretch',
    cues: ['Fingers down, then up', 'Elbow straight'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['wrist'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 45,
    stopIf: 'Stop if you feel pins and needles in your fingers.',
  },
  {
    id: 'ankle-circles',
    name: 'Ankle circles',
    cues: ['Draw a slow circle', 'Both directions'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['ankle'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 45,
    stopIf: 'Stop if the ankle clicks painfully rather than just stiffly.',
  },
  {
    id: 'seated-march',
    name: 'Seated march',
    cues: ['Lift from the hip', 'Sit tall, do not lean'],
    pattern: 'carry',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['hip'],
    visibility: 'discreet',
    reps: 20,
    costSeconds: 55,
    stopIf: 'Stop if your lower back starts doing the work.',
  },
  {
    id: 'glute-squeeze',
    name: 'Seated glute squeeze',
    cues: ['Squeeze, hold five', 'Keep breathing'],
    pattern: 'hinge',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['hip'],
    visibility: 'discreet',
    reps: 10,
    costSeconds: 50,
    stopIf: 'Stop if you get cramp.',
  },
  {
    id: 'chin-tuck',
    name: 'Chin tucks',
    cues: ['Slide the chin back', 'Eyes stay level'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['neck'],
    visibility: 'discreet',
    reps: 10,
    costSeconds: 45,
    stopIf: 'Stop if it brings on a headache.',
  },
  {
    id: 'scap-squeeze',
    name: 'Shoulder blade squeeze',
    cues: ['Blades together and down', 'Hold three'],
    pattern: 'pull',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['back', 'shoulder'],
    visibility: 'discreet',
    reps: 12,
    costSeconds: 50,
    stopIf: 'Stop if you feel it in your neck instead of between the blades.',
  },
  {
    id: 'side-bend',
    name: 'Seated side bend',
    cues: ['Reach long, not down', 'One side at a time'],
    pattern: 'mobility',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['back'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 45,
    stopIf: 'Stop if anything pinches in the lower back.',
  },
  {
    id: 'shoulder-shrug',
    name: 'Shoulder shrugs',
    cues: ['Up to the ears', 'Drop, do not lower'],
    pattern: 'carry',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['shoulder', 'neck'],
    visibility: 'discreet',
    poseCheck: 'shoulder-shrug',
    reps: 12,
    costSeconds: 50,
    stopIf: 'Stop if it tightens into your neck instead of releasing.',
  },
  {
    id: 'lateral-raise',
    name: 'Arm raises to the side',
    cues: ['Lead with the elbows', 'Stop at shoulder height'],
    pattern: 'push',
    places: ['desk', 'floor', 'gym'],
    noise: 'quiet',
    space: 'none',
    workClothes: true,
    loads: ['shoulder'],
    visibility: 'discreet',
    poseCheck: 'arm-raise',
    reps: 12,
    costSeconds: 55,
    stopIf: 'Stop if the shoulder pinches as you pass halfway.',
  },
]

export function byId(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id)
}

/** 这个动作在这个场合能不能做。🔴 只做排除,不做打分 —— 打分在 session 层。 */
export function isAllowed(
  m: Movement,
  place: Place,
  sore: BodyArea[],
  quietOnly: boolean,
  alone = true,
): boolean {
  if (!m.places.includes(place)) return false
  if (place === 'desk' && !m.workClothes) return false
  if (quietOnly && m.noise !== 'quiet') return false
  // 周围有人时只给看不出来是在运动的动作
  if (!alone && m.visibility !== 'discreet') return false
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
