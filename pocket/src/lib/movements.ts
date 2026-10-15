/**
 * movements — 动作库【纯数据 + 纯查询】。
 *
 * 每个动作身上只留会变的东西。入选门槛(穿上班衣服能做、不需要地面器材、不出声)
 * 全库一致,所以写在 MOVEMENTS 上面一次,不再逐个重复。
 *
 * 会变的两维:
 * - visibility: 会不会被看见是在运动。周围有人时只给 discreet。
 * - loads:      压到哪些部位。用户报了酸痛,力量动作避开,活动度动作反而要做。
 *
 * poseCheck 是可选的:有判定器才开摄像头,没有的动作不会假装能检查。
 */

export type BodyArea = 'neck' | 'shoulder' | 'back' | 'hip' | 'knee' | 'ankle' | 'wrist'
export type Pattern = 'squat' | 'hinge' | 'push' | 'pull' | 'mobility' | 'carry'
export type PoseCheckId =
  | 'reach-target'
  | 'reach-high'
  | 'reach-cross'
  | 'head-target'
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
 * 判据只有一条:**会不会改变你的轮廓**。
 *   discreet — 人还在椅子上或原地站着,动的是头、手、肩、脚踝。
 *              隔着办公室看过去,和"坐在工位上"没有区别。
 *   obvious  — 要离开椅子、改变整个身体的形状:蹲下去、从髋折叠、撑墙、拉门框。
 *              远处一眼就是"那人在运动"。
 *
 * 注意不是"吵不吵"。库里每个动作都不出声,所以声音这一维不区分任何东西,
 * 原来的 noise 字段已经删掉了。
 */
export type Visibility = 'discreet' | 'obvious'

export interface Movement {
  id: string
  name: string
  /** 最多两个提示词 —— 屏幕上一次只显示这两个 */
  cues: [string, string]
  pattern: Pattern
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

/**
 * 入选标准(每一条都是从访谈里来的约束,不是口味):
 * - 穿着上班的衣服能做。受访者说门槛在"换衣服"那一步,所以不能有例外。
 * - 站着或坐着就行,不需要地面、不需要器材。
 * - 不出声,共用办公室里能做。
 *
 * 🔴 这些原来是每个动作上的字段,但全库取值一致 —— 字段不区分任何东西,
 * 只是把"每条都满足"重复二十遍。唯一的例外是个跪姿拉伸,
 * 它 workClothes: false,和首页那句"穿着你身上的衣服做"直接冲突,已经删掉。
 * 现在它们是入选门槛,写在这里一次。
 */
export const MOVEMENTS: Movement[] = [
  {
    id: 'chair-squat',
    name: 'Chair squat',
    cues: ['Sit back', 'Chest up'],
    pattern: 'squat',
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
    loads: ['shoulder'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 55,
    poseCheck: 'reach-high',
    stopIf: 'Stop if it pinches at the top.',
  },
  {
    id: 'neck-release',
    name: 'Neck release',
    cues: ['Ear to shoulder', 'Breathe out'],
    pattern: 'mobility',
    loads: ['neck'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 50,
    poseCheck: 'head-target',
    stopIf: 'Stop if anything shoots down your arm.',
  },
  {
    id: 'calf-raise',
    name: 'Calf raise',
    cues: ['Up slow', 'Down slower'],
    pattern: 'carry',
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
    loads: ['neck'],
    visibility: 'discreet',
    seconds: 45,
    costSeconds: 50,
    stopIf: 'Press firmly, never sharply. Stop if it feels pointed rather than dull.',
  },
  {
    id: 'seated-twist',
    name: 'Seated twist',
    cues: ['Reach across your body', 'Turn from the ribs'],
    pattern: 'mobility',
    loads: ['back'],
    visibility: 'discreet',
    seconds: 40,
    costSeconds: 45,
    poseCheck: 'reach-cross',
    stopIf: 'Stop if it pinches in the lower back rather than stretching.',
  },
  {
    id: 'wrist-stretch',
    name: 'Wrist and forearm stretch',
    cues: ['Fingers down, then up', 'Elbow straight'],
    pattern: 'mobility',
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
    loads: ['shoulder'],
    visibility: 'discreet',
    poseCheck: 'arm-raise',
    reps: 12,
    costSeconds: 55,
    stopIf: 'Stop if the shoulder pinches as you pass halfway.',
  },
  {
    id: 'reach-dots',
    name: 'Reach the circles',
    cues: ['Touch it with either hand', 'Reach, do not lean'],
    pattern: 'mobility',
    // 肩 + 上背:去重键要和 Shoulder openers(只有 shoulder)区分开,
    // 否则两个同属 mobility:shoulder,这个最可靠的判定器反而排不进课表
    loads: ['shoulder', 'back'],
    visibility: 'discreet',
    poseCheck: 'reach-target',
    reps: 12,
    costSeconds: 52,
    stopIf: 'Stop if your shoulder pinches as you reach high.',
  },
]

export function byId(id: string): Movement | undefined {
  return MOVEMENTS.find((m) => m.id === id)
}

/** 这个动作现在能不能做。只剩两条真正会变的条件:周围有没有人、哪里酸。 */
export function isAllowed(m: Movement, sore: BodyArea[], alone = true): boolean {
  // 周围有人时只给看不出来是在运动的动作
  if (!alone && m.visibility !== 'discreet') return false
  // 🔴 酸痛 ≠ 不能动:力量动作压到酸痛部位要排除,活动度动作针对酸痛部位恰恰该做
  if (m.pattern !== 'mobility' && m.loads.some((a) => sore.includes(a))) return false
  return true
}

/** 这个动作是不是"专门给某个酸痛部位做的活动度动作"。用来给用户解释为什么它还在。 */
export function targetsSoreArea(m: Movement, sore: BodyArea[]): BodyArea[] {
  if (m.pattern !== 'mobility') return []
  return m.loads.filter((a) => sore.includes(a))
}
