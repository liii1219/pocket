/**
 * CameraCoach — 一次一个动作的摄像头页面。
 *
 * 界面规则(来自访谈,不是审美偏好):
 * - 屏幕上一次只有一个动作、两个提示词、一条反馈。
 * - 不显示分数、不显示历史、不显示任何用户看不懂的数字。
 * - 系统不确定时直接说"看不清",不猜。
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { Movement } from '../lib/movements'
import { CHECKERS, initState, type CheckOutput, type CheckState } from '../lib/pose/checkers'
import type { Landmark } from '../lib/pose/angles'
import { LM } from '../lib/pose/angles'
import { MovementDiagram } from './MovementDiagram'
import { usePose } from './usePose'

const SKELETON: Array<[number, number]> = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftShoulder, LM.leftElbow],
  [LM.leftElbow, LM.leftWrist],
  [LM.rightShoulder, LM.rightElbow],
  [LM.rightElbow, LM.rightWrist],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
  [LM.leftHip, LM.rightHip],
  [LM.leftHip, LM.leftKnee],
  [LM.leftKnee, LM.leftAnkle],
  [LM.rightHip, LM.rightKnee],
  [LM.rightKnee, LM.rightAnkle],
]

interface Props {
  movement: Movement
  onDone: () => void
  onSkip: () => void
}

export function CameraCoach({ movement, onDone, onSkip }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<CheckState>(initState())
  const [out, setOut] = useState<CheckOutput | null>(null)

  const checker = movement.poseCheck ? CHECKERS[movement.poseCheck] : null
  const target = movement.reps ?? 0

  const handleFrame = useCallback(
    (lms: Landmark[]) => {
      draw(canvasRef.current, lms)
      if (!checker) return
      setOut(checker(lms, stateRef.current, performance.now()))
    },
    [checker],
  )

  const { videoRef, status, message, start, stop } = usePose(handleFrame)

  const reps = out?.reps ?? 0
  const done = target > 0 && reps >= target

  const feedback = useMemo(() => {
    if (!checker) return 'No camera check for this one — follow the two cues.'
    if (out == null) return 'Stand where your whole body is in frame.'
    if (!out.confident) return out.cue ?? 'I cannot see you well enough to check this.'
    if (out.cue) return out.cue
    return out.phase === 'down' ? 'Hold, then come back up.' : 'Good. Keep going.'
  }, [checker, out])

  return (
    <div className="coach">
      <div className="coach-head">
        <h2>{movement.name}</h2>
        <p className="cues">
          <span>{movement.cues[0]}</span>
          <span>{movement.cues[1]}</span>
        </p>
      </div>

      {status !== 'running' && <MovementDiagram movementId={movement.id} />}

      <div className="stage">
        <video ref={videoRef} playsInline muted className="cam" />
        <canvas ref={canvasRef} width={640} height={480} className="overlay" />
        {status !== 'running' && (
          <div className="stage-cover">
            {status === 'idle' && (
              <>
                <p>The camera can check this movement. Nothing leaves your phone.</p>
                <button className="primary" onClick={start}>
                  Turn on the check
                </button>
                <button className="ghost" onClick={onSkip}>
                  Do it without the check
                </button>
              </>
            )}
            {status === 'loading' && <p>{message}</p>}
            {(status === 'denied' || status === 'error') && (
              <>
                <p>{message}</p>
                <button className="ghost" onClick={onSkip}>
                  Carry on without it
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="readout">
        <div className="count">
          <strong>{reps}</strong>
          {target > 0 && <span> / {target}</span>}
        </div>
        <p className={out && !out.confident ? 'feedback unsure' : 'feedback'}>{feedback}</p>
      </div>

      <p className="stop-if">{movement.stopIf}</p>

      <div className="actions">
        <button
          className="primary"
          onClick={() => {
            stop()
            onDone()
          }}
        >
          {done ? 'Done — next movement' : 'Next movement'}
        </button>
      </div>
    </div>
  )
}

/** 画骨架。只画,不判断。 */
function draw(canvas: HTMLCanvasElement | null, lms: Landmark[]) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  if (lms.length === 0) return

  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(120, 220, 190, 0.9)'
  for (const [a, b] of SKELETON) {
    const pa = lms[a]
    const pb = lms[b]
    if (!pa || !pb) continue
    if ((pa.visibility ?? 0) < 0.5 || (pb.visibility ?? 0) < 0.5) continue
    ctx.beginPath()
    // 镜像:前置摄像头画面是反的,画点也要跟着反,否则骨架和人对不上
    ctx.moveTo((1 - pa.x) * w, pa.y * h)
    ctx.lineTo((1 - pb.x) * w, pb.y * h)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
  for (const p of lms) {
    if ((p.visibility ?? 0) < 0.5) continue
    ctx.beginPath()
    ctx.arc((1 - p.x) * w, p.y * h, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }
}
