/**
 * MovementDiagram — 动作示意图。
 *
 * 为什么要有:受访者说网上查动作要领没用,因为"我根本不知道自己做出来是什么样"。
 * 文字讲不了髋铰链。这里给两帧简笔画:起始 和 到位,中间一个箭头。
 *
 * 刻意保持简笔:不用真人照片,因为受访数据里"看到别人的身材"会引发比较。
 */

interface Pose {
  head: [number, number]
  shoulder: [number, number]
  elbow: [number, number]
  hand: [number, number]
  hip: [number, number]
  knee: [number, number]
  ankle: [number, number]
}

type PoseKey =
  | 'stand' | 'squatDown'
  | 'hingeDown'
  | 'wallStart' | 'wallDown'
  | 'rowStart' | 'rowPull'
  | 'armsDown' | 'armsUp'
  | 'flat' | 'toes'
  | 'kneelStart' | 'kneelPush'
  | 'neckNeutral' | 'neckTilt'

const POSES: Record<PoseKey, Pose> = {
  stand:      { head: [50, 18], shoulder: [50, 34], elbow: [42, 52], hand: [40, 68], hip: [50, 64], knee: [50, 88], ankle: [50, 112] },
  squatDown:  { head: [44, 30], shoulder: [45, 46], elbow: [58, 54], hand: [70, 52], hip: [46, 76], knee: [64, 90], ankle: [50, 112] },

  hingeDown:  { head: [22, 46], shoulder: [32, 54], elbow: [34, 72], hand: [34, 88], hip: [56, 66], knee: [52, 90], ankle: [50, 112] },

  wallStart:  { head: [38, 26], shoulder: [42, 40], elbow: [58, 40], hand: [74, 40], hip: [50, 70], knee: [52, 92], ankle: [54, 112] },
  wallDown:   { head: [46, 30], shoulder: [50, 44], elbow: [60, 50], hand: [74, 40], hip: [56, 72], knee: [56, 92], ankle: [56, 112] },

  rowStart:   { head: [42, 24], shoulder: [44, 38], elbow: [58, 44], hand: [72, 46], hip: [48, 68], knee: [50, 90], ankle: [52, 112] },
  rowPull:    { head: [36, 26], shoulder: [38, 40], elbow: [30, 52], hand: [60, 46], hip: [44, 70], knee: [48, 90], ankle: [52, 112] },

  armsDown:   { head: [50, 18], shoulder: [50, 34], elbow: [40, 52], hand: [38, 68], hip: [50, 64], knee: [50, 88], ankle: [50, 112] },
  armsUp:     { head: [50, 18], shoulder: [50, 34], elbow: [34, 22], hand: [30, 6],  hip: [50, 64], knee: [50, 88], ankle: [50, 112] },

  flat:       { head: [50, 18], shoulder: [50, 34], elbow: [42, 52], hand: [40, 68], hip: [50, 64], knee: [50, 88], ankle: [50, 112] },
  toes:       { head: [50, 10], shoulder: [50, 26], elbow: [42, 44], hand: [40, 60], hip: [50, 56], knee: [50, 82], ankle: [50, 106] },

  kneelStart: { head: [40, 30], shoulder: [42, 44], elbow: [40, 60], hand: [40, 74], hip: [46, 74], knee: [30, 96], ankle: [20, 112] },
  kneelPush:  { head: [36, 26], shoulder: [40, 40], elbow: [38, 56], hand: [38, 70], hip: [50, 74], knee: [30, 96], ankle: [20, 112] },

  neckNeutral:{ head: [50, 18], shoulder: [50, 34], elbow: [42, 52], hand: [40, 68], hip: [50, 64], knee: [50, 88], ankle: [50, 112] },
  neckTilt:   { head: [40, 22], shoulder: [50, 34], elbow: [42, 52], hand: [40, 68], hip: [50, 64], knee: [50, 88], ankle: [50, 112] },
}

/** 每个动作画哪两帧,以及两帧各自的小标签。 */
const FRAMES: Record<string, { a: PoseKey; b: PoseKey; labelA: string; labelB: string }> = {
  'chair-squat':        { a: 'stand',       b: 'squatDown', labelA: 'Stand',  labelB: 'Sit back' },
  'hip-hinge':          { a: 'stand',       b: 'hingeDown', labelA: 'Tall',   labelB: 'Hips back' },
  'wall-push':          { a: 'wallStart',   b: 'wallDown',  labelA: 'Arms long', labelB: 'Chest to wall' },
  'desk-row':           { a: 'rowStart',    b: 'rowPull',   labelA: 'Lean back', labelB: 'Pull' },
  'shoulder-openers':   { a: 'armsDown',    b: 'armsUp',    labelA: 'Down',   labelB: 'Overhead' },
  'neck-release':       { a: 'neckNeutral', b: 'neckTilt',  labelA: 'Neutral', labelB: 'Ear to shoulder' },
  'hip-flexor-stretch': { a: 'kneelStart',  b: 'kneelPush', labelA: 'Kneel',  labelB: 'Hips forward' },
  'calf-raise':         { a: 'flat',        b: 'toes',      labelA: 'Flat',   labelB: 'Up on toes' },
}

function Figure({ pose, dim = false }: { pose: Pose; dim?: boolean }) {
  const stroke = dim ? 'rgba(147,161,177,.55)' : 'var(--accent)'
  const L = (a: [number, number], b: [number, number], key: string) => (
    <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
  )
  return (
    <g stroke={stroke} strokeWidth={4} strokeLinecap="round" fill="none">
      <circle cx={pose.head[0]} cy={pose.head[1]} r={8} />
      {L(pose.shoulder, pose.hip, 'torso')}
      {L(pose.shoulder, pose.elbow, 'upperarm')}
      {L(pose.elbow, pose.hand, 'forearm')}
      {L(pose.hip, pose.knee, 'thigh')}
      {L(pose.knee, pose.ankle, 'shin')}
    </g>
  )
}

export function MovementDiagram({ movementId }: { movementId: string }) {
  const f = FRAMES[movementId]
  if (!f) return null
  return (
    <div className="diagram">
      <figure>
        <svg viewBox="0 0 100 124" role="img" aria-label={`${f.labelA} position`}>
          <Figure pose={POSES[f.a]} dim />
        </svg>
        <figcaption>{f.labelA}</figcaption>
      </figure>

      <div className="arrow" aria-hidden="true">
        <svg viewBox="0 0 40 24">
          <path d="M4 12 H30 M24 6 L32 12 L24 18" stroke="var(--muted)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <figure>
        <svg viewBox="0 0 100 124" role="img" aria-label={`${f.labelB} position`}>
          <Figure pose={POSES[f.b]} />
        </svg>
        <figcaption>{f.labelB}</figcaption>
      </figure>
    </div>
  )
}
