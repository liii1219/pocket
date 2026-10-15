/**
 * PointMap — 穴位/着力点定位图。
 *
 * 为什么不用简笔小人:眼保健操和穴位按摩的要点不是"身体摆成什么姿势",
 * 而是"手指按在哪"。小人画不出这个,所以这里画脸、后脑和手,把点标在上面。
 *
 * 刻意不写穴位的中文名或经络编号:受访者里没有人懂这套术语,
 * 写了等于又多一层要解读的东西 —— 和"看不懂指标"那条发现冲突。
 * 只写解剖位置("眉毛内侧端下方"),照着就能按。
 */

interface Spot {
  /** viewBox 坐标 */
  at: [number, number]
  /** 鼠标/读屏用的说明,也显示在图下方 */
  label: string
  /** 左右对称的点只写一个,画的时候镜像 */
  mirror?: boolean
}

type MapKind = 'face' | 'headBack' | 'hand'

const MAPS: Record<MapKind, { spots: Spot[]; note: string }> = {
  face: {
    spots: [
      { at: [36, 44], label: 'Inner corner of the eyebrow, in the small dip', mirror: true },
      { at: [36, 58], label: 'On the cheekbone, below the centre of the eye', mirror: true },
      { at: [22, 50], label: 'The soft hollow at the side of the eye', mirror: true },
    ],
    note: 'Eyes closed. Press with the pad of the finger, hold, release. Never press the eyeball.',
  },
  headBack: {
    spots: [
      { at: [34, 62], label: 'Base of the skull, in the hollow beside the neck muscle', mirror: true },
      { at: [26, 84], label: 'Top of the shoulder, halfway out from the neck', mirror: true },
    ],
    note: 'Thumbs underneath, fingers resting on the head. Press up and in, not down.',
  },
  hand: {
    spots: [
      { at: [38, 40], label: 'The web between thumb and index finger' },
      { at: [50, 74], label: 'Centre of the palm' },
      { at: [64, 34], label: 'Base of the little finger' },
    ],
    note: 'Press with the opposite thumb. Firm and dull, never sharp.',
  },
}

/** 脸、后脑、手的轮廓。只用路径,不用图片 —— 和简笔小人一样避免真人影像。 */
function Outline({ kind }: { kind: MapKind }) {
  const s = { stroke: 'var(--muted)', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const }
  if (kind === 'face') {
    return (
      <g {...s}>
        <ellipse cx={50} cy={52} rx={30} ry={38} />
        <path d="M30 42 Q36 38 42 42" />
        <path d="M58 42 Q64 38 70 42" />
        <ellipse cx={36} cy={50} rx={7} ry={4} />
        <ellipse cx={64} cy={50} rx={7} ry={4} />
        <path d="M50 52 v10" />
        <path d="M42 72 Q50 77 58 72" />
      </g>
    )
  }
  if (kind === 'headBack') {
    return (
      <g {...s}>
        <ellipse cx={50} cy={40} rx={26} ry={30} />
        <path d="M40 66 v10 M60 66 v10" />
        <path d="M24 88 Q50 78 76 88" />
        <path d="M50 70 v22" />
      </g>
    )
  }
  return (
    <g {...s}>
      <path d="M38 96 Q34 70 36 56 Q37 48 42 48 Q46 48 46 56 L46 62" />
      <path d="M46 62 V28 Q46 22 51 22 Q56 22 56 28 V62" />
      <path d="M56 62 V32 Q56 26 61 26 Q66 26 66 32 V64" />
      <path d="M66 64 V40 Q66 35 70 35 Q74 35 74 40 V70" />
      <path d="M38 62 Q30 52 28 46 Q26 40 31 38 Q35 37 38 42 L44 54" />
      <path d="M38 96 Q56 100 74 92 Q78 78 74 70" />
    </g>
  )
}

export function PointMap({ kind }: { kind: MapKind }) {
  const { spots, note } = MAPS[kind]
  const all = spots.flatMap((s) =>
    s.mirror ? [s, { ...s, at: [100 - s.at[0], s.at[1]] as [number, number] }] : [s],
  )
  return (
    <div className="pointmap">
      <svg viewBox="0 0 100 110" role="img" aria-label="Where to press">
        <Outline kind={kind} />
        {all.map((s, i) => (
          <g key={i}>
            <circle cx={s.at[0]} cy={s.at[1]} r={6} fill="var(--accent)" opacity={0.22} />
            <circle cx={s.at[0]} cy={s.at[1]} r={2.6} fill="var(--accent)" />
          </g>
        ))}
      </svg>
      <ol className="spots">
        {spots.map((s, i) => (
          <li key={i}>{s.label}</li>
        ))}
      </ol>
      <p className="spot-note">{note}</p>
    </div>
  )
}

/** 哪些动作用定位图而不是小人。 */
export const POINT_MAPS: Record<string, MapKind> = {
  'eye-exercises': 'face',
  'neck-acupressure': 'headBack',
  'wrist-stretch': 'hand',
}
