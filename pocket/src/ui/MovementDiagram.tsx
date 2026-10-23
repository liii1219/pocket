import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { PointMap, POINT_MAPS } from './PointMap'
import { TargetPreview } from './TargetPreview'
import { targetSpots } from '../lib/pose/checkers'
import { RIGS } from './rigs'

const Figure3D = lazy(() => import('./Figure3D').then((m) => ({ default: m.Figure3D })))

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

const JOINTS: Array<keyof Pose> = ['head', 'shoulder', 'elbow', 'hand', 'hip', 'knee', 'ankle']

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const out = {} as Pose
  for (const j of JOINTS) {
    out[j] = [a[j][0] + (b[j][0] - a[j][0]) * t, a[j][1] + (b[j][1] - a[j][1]) * t]
  }
  return out
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)
const CYCLE_MS = 2600

function useCycle(enabled: boolean) {
  const [t, setT] = useState(0)
  const raf = useRef(0)
  useEffect(() => {
    if (!enabled) {
      setT(1)
      return
    }
    const start = performance.now()
    const tick = (now: number) => {
      const p = ((now - start) % CYCLE_MS) / CYCLE_MS
      setT(ease(p < 0.5 ? p * 2 : (1 - p) * 2))
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [enabled])
  return t
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

function ShrugPreview() {
  return (
    <div className="targetpreview">
      <svg viewBox="0 0 100 75" role="img" aria-label="Shoulder shrugs guidance">
        <rect x={1} y={1} width={98} height={73} rx={4} fill="none" stroke="var(--line)" strokeWidth={1.2} />
        <g stroke="var(--muted)" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.75}>
          <circle cx={50} cy={26} r={6} />
          <path d="M50 32 V54" />
          <path d="M34 40 Q50 37 66 40" />
          <path d="M34 40 L30 52 M66 40 L70 52" />
        </g>
        <g stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="3 3">
          <path d="M36 29 Q50 28 64 29" />
        </g>
        <g stroke="var(--accent)" strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M36 37 L36 31 M33 34 L36 31 L39 34" />
          <path d="M64 37 L64 31 M61 34 L64 31 L67 34" />
        </g>
      </svg>
      <p className="targetpreview-note">
        The camera calibrates to your normal resting posture. Lift your shoulders straight up towards your ears, then let them drop back down completely.
      </p>
    </div>
  )
}

export function MovementDiagram({ movementId, checkId }: { movementId: string; checkId?: string }) {
  const pointKind = POINT_MAPS[movementId]
  const f = FRAMES[movementId]
  const reduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    
  const needsCycle = !!f || movementId === 'focal-shift' || movementId === 'desk-leg-press'
  const t = useCycle(!reduced && needsCycle)

  // 🔴 全新的 20-20-20 Focal Shift 景深版指导图解
  if (movementId === 'focal-shift') {
    const isNear = t < 0.5
    return (
      <div className="diagram">
        <figure className="animated">
          <svg viewBox="0 0 100 124" role="img" aria-label="Shift visual focus">
            {/* 远景目标：带风景的窗户（随焦点虚化淡出） */}
            <g opacity={isNear ? 0.25 : 1} style={{ transition: 'opacity 0.3s' }}>
              <rect x="25" y="10" width="50" height="34" rx="4" fill="var(--panel)" stroke={isNear ? "var(--muted)" : "var(--accent)"} strokeWidth="3" />
              <path d="M 25 30 Q 38 18 50 30 T 75 30" stroke={isNear ? "var(--muted)" : "var(--accent)"} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>

            {/* 近景目标：面前的一个圆圈（随焦点虚化淡出） */}
            <g opacity={isNear ? 1 : 0.25} style={{ transition: 'opacity 0.3s' }}>
              <circle cx="50" cy="65" r="12" fill="var(--panel)" stroke={isNear ? "var(--accent)" : "var(--muted)"} strokeWidth="3" />
              <circle cx="50" cy="65" r="4" fill={isNear ? "var(--accent)" : "var(--muted)"} />
            </g>

            {/* 眼睛：在画面正下方往上看 */}
            <g stroke="var(--muted)" strokeWidth="2.5" fill="var(--panel)" strokeLinecap="round">
              <path d="M 30 106 Q 50 94 70 106 Q 50 118 30 106" />
              <circle cx="50" cy="106" r="4" fill="var(--muted)" />
            </g>

            {/* 发散的视觉引导虚线 */}
            <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" opacity={0.6}>
              {isNear ? (
                <path d="M 44 96 L 46 80 M 56 96 L 54 80" />
              ) : (
                <path d="M 42 96 L 30 48 M 58 96 L 70 48" />
              )}
            </g>
          </svg>
          <figcaption>{isNear ? 'Focus near' : 'Focus far (6m away)'}</figcaption>
        </figure>
        
        {/* 第二帧：保持在远处的失焦定格画面 */}
        <figure>
          <svg viewBox="0 0 100 124" role="img" aria-label="Hold focus">
            <g opacity={1}>
              <rect x="25" y="10" width="50" height="34" rx="4" fill="var(--panel)" stroke="var(--accent)" strokeWidth="3" />
              <path d="M 25 30 Q 38 18 50 30 T 75 30" stroke="var(--accent)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>
            <g opacity={0.25}>
              <circle cx="50" cy="65" r="12" fill="var(--panel)" stroke="var(--muted)" strokeWidth="3" />
              <circle cx="50" cy="65" r="4" fill="var(--muted)" />
            </g>
            <g stroke="var(--muted)" strokeWidth="2.5" fill="var(--panel)" strokeLinecap="round">
              <path d="M 30 106 Q 50 94 70 106 Q 50 118 30 106" />
              <circle cx="50" cy="106" r="4" fill="var(--muted)" />
            </g>
            <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 4" opacity={0.6}>
              <path d="M 42 96 L 30 48 M 58 96 L 70 48" />
            </g>
          </svg>
          <figcaption>Hold focus for 20s</figcaption>
        </figure>
      </div>
    )
  }

  // 桌下腿部抗阻 (Desk-Under Leg Press)
  if (movementId === 'desk-leg-press') {
    return (
      <div className="diagram">
        <figure className="animated">
          <svg viewBox="0 0 100 124" role="img" aria-label="Desk-Under Leg Press">
            <g stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M 45 60 L 95 60 M 85 60 L 85 120" />
              <path d="M 5 85 L 35 85 M 20 85 L 20 120" />
            </g>
            <g opacity={0.16} stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" fill="none">
              <circle cx="25" cy="25" r="8" />
              <path d="M 25 33 L 25 78 L 55 78 L 55 110" />
            </g>
            <g stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" fill="none">
              <circle cx="25" cy="25" r="8" />
              <path d="M 25 33 L 25 78" />
              <path d={`M 25 78 L 55 ${t < 0.5 ? 78 : 62}`} />
              <path d={`M 55 ${t < 0.5 ? 78 : 62} L 55 110`} />
            </g>
            {t >= 0.5 && (
              <g stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" fill="none">
                <path d="M 40 72 L 40 64 M 37 67 L 40 64 L 43 67" />
                <path d="M 50 72 L 50 64 M 47 67 L 50 64 L 53 67" />
              </g>
            )}
          </svg>
          <figcaption>{t < 0.5 ? 'Feet flat' : 'Press UP into desk'}</figcaption>
        </figure>
        <figure>
          <svg viewBox="0 0 100 124" role="img">
            <g stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none">
              <path d="M 45 60 L 95 60 M 85 60 L 85 120" />
              <path d="M 5 85 L 35 85 M 20 85 L 20 120" />
            </g>
            <g stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" fill="none">
              <circle cx="25" cy="25" r="8" />
              <path d="M 25 33 L 25 78 L 55 62 L 55 110" />
            </g>
            <g stroke="var(--warn)" strokeWidth="2" strokeLinecap="round" fill="none">
              <path d="M 40 72 L 40 64 M 37 67 L 40 64 L 43 67" />
              <path d="M 50 72 L 50 64 M 47 67 L 50 64 L 53 67" />
            </g>
          </svg>
          <figcaption>Hold pressure</figcaption>
        </figure>
      </div>
    )
  }

  const isNeckCombo = checkId && targetSpots(checkId).length > 0 && movementId === 'neck-release'
  const isShrugCombo = movementId === 'shoulder-shrug'

  if (isNeckCombo || isShrugCombo) {
    return (
      <>
        <style>{`
          @media (min-width: 761px) {
            .stage-row:has(.combo-view) {
              grid-template-columns: minmax(0, 1fr) 380px !important;
              align-items: stretch !important;
            }
            .stage-row:has(.combo-view) .stage {
              aspect-ratio: auto !important;
            }
            .combo-view {
              display: flex;
              gap: 12px;
              align-items: stretch !important;
            }
            .combo-view > div {
              flex: 1;
              min-width: 0;
              display: flex;
              flex-direction: column;
            }
            .combo-view .fig3d, 
            .combo-view .targetpreview {
              flex: 1;
              margin: 0;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
            }
            .combo-view .fig3d-canvas {
              height: 0 !important; 
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .combo-view .fig3d-canvas canvas {
              max-height: 100% !important;
              width: auto !important;
            }
          }
        `}</style>
        
        <div className="combo-view">
          <div>
            <Suspense fallback={<div className="fig3d fig3d-loading">Loading…</div>}>
              <Figure3D movementId={movementId} />
            </Suspense>
          </div>
          <div>
            {isNeckCombo ? <TargetPreview checkId={checkId!} /> : <ShrugPreview />}
          </div>
        </div>
      </>
    )
  }

  if (checkId && targetSpots(checkId).length > 0) return <TargetPreview checkId={checkId} />

  if (pointKind) return <PointMap kind={pointKind} />
  
  if (RIGS[movementId]) {
    return (
      <Suspense fallback={<div className="fig3d fig3d-loading">Loading the figure…</div>}>
        <Figure3D movementId={movementId} />
      </Suspense>
    )
  }
  
  if (!f) return null

  const a = POSES[f.a]
  const b = POSES[f.b]

  return (
    <div className="diagram">
      <figure className="animated">
        <svg viewBox="0 0 100 124" role="img" aria-label={`${f.labelA} to ${f.labelB}`}>
          <g opacity={0.16}>
            <Figure pose={a} dim />
            <Figure pose={b} dim />
          </g>
          <Figure pose={lerpPose(a, b, t)} />
        </svg>
        <figcaption>{t < 0.5 ? f.labelA : f.labelB}</figcaption>
      </figure>

      <figure>
        <svg viewBox="0 0 100 124" role="img" aria-label={`${f.labelB} position`}>
          <Figure pose={b} />
        </svg>
        <figcaption>{f.labelB}</figcaption>
      </figure>
    </div>
  )
}