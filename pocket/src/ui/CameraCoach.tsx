/**
 * CameraCoach — 一次一个动作的摄像头页面。
 *
 * 界面规则(来自访谈,不是审美偏好):
 * - 屏幕上一次只有一个动作、两个提示词、一条反馈。
 * - 不显示分数、不显示历史、不显示任何用户看不懂的数字。
 * - 系统不确定时直接说"看不清",不猜。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Movement } from '../lib/movements'
import { CHECK_SETUP, CHECKERS, initState, type CheckOutput, type CheckState } from '../lib/pose/checkers'
import type { Landmark } from '../lib/pose/angles'
import { LM } from '../lib/pose/angles'
import { MovementDiagram } from './MovementDiagram'
import { usePose, type FrameData } from './usePose'
import { drawBlurred } from './blur'

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
  /** 虚化后的画面画在这张上,开虚化时它盖住 <video> */
  const camCanvasRef = useRef<HTMLCanvasElement>(null)
  const [blur, setBlur] = useState(true)
  const stateRef = useRef<CheckState>(initState())
  const [out, setOut] = useState<CheckOutput | null>(null)

  /**
   * 🔴 换动作时清零。
   * App 渲染 CameraCoach 时没给 key,所以换动作时 React 复用同一个组件实例,
   * 而 useRef(initState()) 只在首次挂载跑一次 —— 次数会从上一个动作接着数。
   * 这里不用 key 强制重挂载,因为那会把摄像头流一起拆掉,每换一个动作都要重开一次。
   */
  useEffect(() => {
    stateRef.current = initState()
    setOut(null)
  }, [movement.id])

  const checker = movement.poseCheck ? CHECKERS[movement.poseCheck] : null
  const target = movement.reps ?? 0

  const handleFrame = useCallback(
    (f: FrameData) => {
      const cam = camCanvasRef.current
      const vid = videoRef.current
      if (blur && cam && vid) drawBlurred(cam, vid, f.mask, f.maskW, f.maskH, f.landmarks)
      draw(canvasRef.current, f.landmarks)
      if (!checker) return
      /**
       * 🔴 必须把新状态写回 ref。
       * 之前只把 stateRef.current 传进去、却没接住返回值,等于每一帧都从初始状态重算:
       * phase 永远停在 'up',走不完 up→down→up,次数永远是 0;
       * 基线采样数也每帧归零,"正在学习静息位置"的提示永远不消失。
       * CheckOutput 继承自 CheckState,所以可以直接当作下一帧的输入。
       */
      const next = checker(f.landmarks, stateRef.current, performance.now(), f.world)
      stateRef.current = next
      setOut(next)
    },
    // videoRef 是稳定的 ref,不用进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checker, blur],
  )

  const { videoRef, status, message, start, stop, cameras, cameraId, pickCamera, canZoom, widen } =
    usePose(handleFrame, blur)

  const reps = out?.reps ?? 0
  const done = target > 0 && reps >= target

  const feedback = useMemo(() => {
    if (out == null) return 'Stand where your whole body is in frame.'
    if (!out.confident) return out.cue ?? 'I cannot see you well enough to check this.'
    if (out.cue) return out.cue
    return out.phase === 'down' ? 'Hold, then come back up.' : 'Good. Keep going.'
  }, [checker, out])

  const head = (
    <div className="coach-head">
      <h2>{movement.name}</h2>
      <p className="cues">
        <span>{movement.cues[0]}</span>
        <span>{movement.cues[1]}</span>
      </p>
    </div>
  )

  /**
   * 🔴 没有判定器就不出摄像头。
   * 十八个动作里只有三个有姿态判定。之前不管有没有,一律弹"Turn on the check",
   * 用户点开之后摄像头确实打开了,但什么都不判 —— 看起来像坏的。
   * 而且为判不了的动作白白加载 9.4MB 的模型。
   */
  if (!checker) {
    return (
      <div className="coach">
        {head}
        <MovementDiagram movementId={movement.id} />
        <p className="no-check">
          Follow the two cues. There is no camera check for this one, so nothing is watching.
        </p>
        <p className="stop-if">{movement.stopIf}</p>
        <div className="actions">
          <button className="primary" onClick={onDone}>
            Next movement
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="coach">
      {head}

      {status !== 'running' && <MovementDiagram movementId={movement.id} />}

      <div className="stage">
        <video ref={videoRef} playsInline muted className="cam" style={{ opacity: blur ? 0 : 1 }} />
        <canvas
          ref={camCanvasRef}
          width={640}
          height={480}
          className="cam"
          style={{ display: blur ? 'block' : 'none' }}
        />
        <canvas ref={canvasRef} width={640} height={480} className="overlay" />
        {status !== 'running' && (
          <div className="stage-cover">
            {status === 'idle' && (
              <>
                <p className="setup">{movement.poseCheck && CHECK_SETUP[movement.poseCheck]}</p>
                <p>Nothing leaves this device.</p>
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

      {status === 'running' && (
        <p className="readout-meta">
          {out?.angle != null && <span>{out.angle}</span>}
          <span>
            {cameras.length} camera{cameras.length === 1 ? '' : 's'} found
            {cameras.length === 1 && ' — connect a phone for a second one'}
          </span>
        </p>
      )}

      {status === 'running' && (
        <div className="camctl">
          <button className={blur ? 'chip on' : 'chip'} onClick={() => setBlur((b) => !b)}>
            Blur background
          </button>
          {canZoom && (
            <button className="chip" onClick={() => void widen()}>
              Widest view
            </button>
          )}
          {cameras.length > 1 && (
            <select
              className="chip"
              value={cameraId ?? ''}
              onChange={(e) => void pickCamera(e.target.value)}
            >
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>
                  {c.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

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
