/**
 * CameraCoach — 一次一个动作的摄像头页面。
 *
 * 核心升级：
 * 1. 倒计时与节拍器均加入 4 秒"开场白缓冲"，等语音介绍完、用户摆好姿势再开始计时。
 * 2. 自动节拍器：每 3.5 秒报一次数。
 * 3. 智能穿插：在第 2 次和第 4 次自动重申动作指导 (cues)，逢 3 随机鼓励。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Movement } from '../lib/movements'
import { CHECK_SETUP, CHECK_UNIT, CHECKERS, initState, targetRadius, type CheckOutput, type CheckState } from '../lib/pose/checkers'
import type { Landmark } from '../lib/pose/angles'
import { LM, mid } from '../lib/pose/angles'
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
  const camCanvasRef = useRef<HTMLCanvasElement>(null)
  const [blur, setBlur] = useState(true)
  
  const [voiceOn, setVoiceOn] = useState(true)
  const [manualMode, setManualMode] = useState(false)
  const [manualRep, setManualRep] = useState(0)

  const [blurMode, setBlurMode] = useState<'mask' | 'outline' | 'none'>('none')
  const stateRef = useRef<CheckState>(initState())
  const [out, setOut] = useState<CheckOutput | null>(null)

  const lastSpokenCue = useRef<string | null>(null)
  const lastSpokenRep = useRef<number>(-1)
  const timeUpSpoken = useRef<boolean>(false)
  const announcedIdRef = useRef<string | null>(null)

  useEffect(() => {
    stateRef.current = initState()
    setOut(null)
    setManualMode(false)
    setManualRep(0)
    lastSpokenCue.current = null
    lastSpokenRep.current = -1
    timeUpSpoken.current = false
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [movement.id])

  const checker = movement.poseCheck ? CHECKERS[movement.poseCheck] : null
  const target = movement.reps ?? 0

  const handleFrame = useCallback(
    (f: FrameData) => {
      const cam = camCanvasRef.current
      const vid = videoRef.current
      if (blur && cam && vid) {
        const mode = drawBlurred(cam, vid, f.mask, f.maskW, f.maskH, f.landmarks)
        setBlurMode((m) => (m === mode ? m : mode))
      }
      draw(canvasRef.current, f.landmarks, stateRef.current, movement.poseCheck)
      if (!checker) return
      
      const next = checker(f.landmarks, stateRef.current, performance.now(), f.world)
      stateRef.current = next
      setOut(next)
    },
    [checker, blur],
  )

  const {
    videoRef, status, message, start, stop,
    cameras, cameraId, pickCamera, canZoom, widen, refreshCameras, rawCameraCount,
  } = usePose(handleFrame, blur)

  const isRunning = status === 'running'
  const isManual = !checker || manualMode
  const shouldRunTimer = isRunning || isManual

  useEffect(() => {
    if (manualMode && out?.reps) {
      setManualRep(out.reps)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode])

  const timed = movement.seconds != null && movement.reps == null
  const [left, setLeft] = useState(movement.seconds ?? 0)
  
  useEffect(() => {
    setLeft(movement.seconds ?? 0)
  }, [movement.id, movement.seconds])

  // 🔴 倒计时引擎：加入了 4 秒延时缓冲，等开场白说完再扣时间
  useEffect(() => {
    if (!movement.seconds || !shouldRunTimer) return
    let timerId: number
    const delayId = setTimeout(() => {
      timerId = window.setInterval(() => setLeft((v) => (v > 0 ? v - 1 : 0)), 1000)
    }, 4000) // 等待 4 秒开场白
    
    return () => {
      clearTimeout(delayId)
      clearInterval(timerId)
    }
  }, [movement.id, movement.seconds, shouldRunTimer])

  // 🔴 节拍器引擎：同样等待 4 秒开场白后再开始递增动作次数
  useEffect(() => {
    if (!isManual || timed) return
    let timerId: number
    const delayId = setTimeout(() => {
      timerId = window.setInterval(() => {
        setManualRep(r => {
          if (r >= target) {
            clearInterval(timerId)
            return r
          }
          return r + 1
        })
      }, 3500) // 3.5秒一个动作，节奏适中
    }, 4000) // 等待 4 秒开场白
    
    return () => {
      clearTimeout(delayId)
      clearInterval(timerId)
    }
  }, [isManual, timed, target])

  const speak = useCallback((text: string) => {
    if (!voiceOn || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 1.05
    window.speechSynthesis.speak(u)
  }, [voiceOn])

  // 1. 新动作开场白
  useEffect(() => {
    if (!shouldRunTimer || !voiceOn || announcedIdRef.current === movement.id) return
    
    let text = `${movement.name}. `
    if (movement.reps) text += `Do ${movement.reps} reps. `
    if (movement.seconds) text += `Hold for ${movement.seconds} seconds. `
    text += `${movement.cues[0]}. ${movement.cues[1]}.`
    
    speak(text)
    announcedIdRef.current = movement.id
  }, [movement.id, movement.name, movement.reps, movement.seconds, movement.cues, speak, voiceOn, shouldRunTimer])

  // 2. 摄像头工作时的精准反馈
  useEffect(() => {
    if (!voiceOn || isManual || timed || !out) return
    const done = target > 0 && out.reps >= target

    if (out.counted && out.reps !== lastSpokenRep.current) {
      lastSpokenRep.current = out.reps
      if (done) {
        speak('Done. Excellent work.')
      } else if (out.cue) {
        speak(`${out.reps}. ${out.cue}`)
      } else {
        const ENCOURAGEMENTS = ["Great job.", "Keep it up.", "Nice form."]
        const cheer = (out.reps % 3 === 0 || out.reps === 1) 
          ? ` ${ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}` : ''
        speak(`${out.reps}.${cheer}`)
      }
      lastSpokenCue.current = out.cue
      return
    }

    if (out.cue && out.cue !== lastSpokenCue.current && !out.counted) {
      speak(out.cue)
      lastSpokenCue.current = out.cue
    } else if (!out.cue) {
      lastSpokenCue.current = null
    }
  }, [status, out, timed, voiceOn, isManual, target, speak])

  // 3. 脱机模式的自动报数、动作指导与随机鼓励
  useEffect(() => {
    if (!voiceOn || !isManual || timed || manualRep === 0) return
    if (manualRep === lastSpokenRep.current) return
    lastSpokenRep.current = manualRep

    if (manualRep === target) {
      speak(`${manualRep}. Done. Great job.`)
    } else {
      let extra = ""
      if (manualRep === 2) {
        extra = ` ${movement.cues[0]}.`
      } else if (manualRep === 4 && movement.cues[1]) {
        extra = ` ${movement.cues[1]}.`
      } else if (manualRep % 3 === 0) {
        const ENCOURAGEMENTS = ["Keep going.", "Nice and steady.", "Doing great.", "Almost there."]
        extra = ` ${ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}`
      }
      speak(`${manualRep}.${extra}`)
    }
  }, [manualRep, isManual, timed, target, voiceOn, movement.cues, speak])

  // 4. 保持类动作的关键节点（倒计时）
  useEffect(() => {
    if (!timed || !voiceOn || !shouldRunTimer) return
    const total = movement.seconds ?? 0
    const half = Math.floor(total / 2)
    
    if (left === half && half >= 10) {
       const ENCOURAGEMENTS = ["Keep breathing.", "Hold it there.", "Looking good."]
       const cheer = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
       speak(`Halfway there. ${cheer}`)
    } 
    else if (left === 10 && total > 15) {
       speak('Just 10 seconds left. Almost there.')
    } 
    else if (left === 0 && !timeUpSpoken.current) {
       speak('Time is up. Well done.')
       timeUpSpoken.current = true
    }
  }, [left, timed, voiceOn, shouldRunTimer, movement.seconds, speak])

  const reps = isManual ? manualRep : (out?.reps ?? 0)
  const done = target > 0 && reps >= target

  const feedback = useMemo(() => {
    if (out == null) return 'Stand where your whole body is in frame.'
    if (!out.confident) return out.cue ?? 'I cannot see you well enough to check this.'
    if (out.cue) return out.cue
    return out.phase === 'down' ? 'Hold, then come back up.' : 'Good. Keep going.'
  }, [checker, out])

  const head = (
    <div className="coach-head" style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', justifyContent: 'space-between' }}>
      <div>
        <h2>{movement.name}</h2>
        <p className="cues">
          <span>{movement.cues[0]}</span>
          <span>{movement.cues[1]}</span>
        </p>
      </div>
      <button className={voiceOn ? 'chip on' : 'chip'} onClick={() => setVoiceOn((v) => !v)} style={{ flexShrink: 0 }}>
        Voice: {voiceOn ? 'On' : 'Off'}
      </button>
    </div>
  )

  if (!checker || manualMode) {
    return (
      <div className="coach">
        {head}
        <MovementDiagram movementId={movement.id} checkId={movement.poseCheck} />
        
        <div className="readout" style={{ justifyContent: 'center', margin: '20px 0' }}>
          <div className="count" style={{ fontSize: '48px' }}>
            {timed ? (
              <><strong>{left}</strong><span style={{ fontSize: '24px' }}>s</span></>
            ) : (
              <><strong>{manualRep}</strong><span style={{ fontSize: '24px' }}> / {target}</span></>
            )}
          </div>
        </div>

        <p className="no-check" style={{ textAlign: 'center' }}>
          {manualMode 
            ? 'Camera check is off. Follow the pace and voice cues.'
            : 'Follow the two cues. There is no camera check for this one.'}
        </p>
        <p className="stop-if">{movement.stopIf}</p>
        <div className="actions">
          <button className="primary" onClick={onDone}>
            {done ? 'Done — next movement' : 'Next movement'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="coach">
      {head}

      {status !== 'running' && <MovementDiagram movementId={movement.id} checkId={movement.poseCheck} />}

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
                <button className="ghost" onClick={() => setManualMode(true)}>
                  Follow by voice only
                </button>
              </>
            )}
            {status === 'loading' && <p>{message}</p>}
            {(status === 'denied' || status === 'error') && (
              <>
                <p>{message}</p>
                <button className="ghost" onClick={() => setManualMode(true)}>
                  Follow by voice only
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="readout">
        <div className="count">
          {timed ? (
            <>
              <strong>{left}</strong>
              <span>s</span>
            </>
          ) : (
            <>
              <strong>{reps}</strong>
              {target > 0 && <span> / {target}</span>}
            </>
          )}
        </div>
        <p className={out && !out.confident ? 'feedback unsure' : 'feedback'}>{feedback}</p>
      </div>

      {status === 'running' && (
        <p className="readout-meta">
          {out?.angle != null && movement.poseCheck && (
            <span>{out.angle}{CHECK_UNIT[movement.poseCheck]}</span>
          )}
          {blur && (
            <span className={blurMode === 'none' ? 'warn' : undefined}>
              blur: {blurMode === 'mask' ? 'cut-out' : blurMode === 'outline' ? 'outline' : 'not working'}
            </span>
          )}
          <span>
            {cameras.length} camera{cameras.length === 1 ? '' : 's'} usable
            {rawCameraCount > cameras.length && ` (${rawCameraCount} reported, rest are desk views)`}
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
          {cameras.length > 0 && (
            <select className="chip" value={cameraId ?? ''} onChange={(e) => void pickCamera(e.target.value)}>
              {cameras.map((c) => (
                <option key={c.deviceId} value={c.deviceId}>{c.label}</option>
              ))}
            </select>
          )}
          <button className="chip" onClick={() => void refreshCameras()}>
            Find other cameras
          </button>
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

function draw(canvas: HTMLCanvasElement | null, lms: Landmark[], state?: CheckState, checkId?: string) {
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const { width: w, height: h } = canvas
  ctx.clearRect(0, 0, w, h)
  if (lms.length === 0) return

  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(120, 220, 190, 0.35)'
  for (const [a, b] of SKELETON) {
    const pa = lms[a]
    const pb = lms[b]
    if (!pa || !pb) continue
    if ((pa.visibility ?? 0) < 0.5 || (pb.visibility ?? 0) < 0.5) continue
    ctx.beginPath()
    ctx.moveTo((1 - pa.x) * w, pa.y * h)
    ctx.lineTo((1 - pb.x) * w, pb.y * h)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  for (const p of lms) {
    if ((p.visibility ?? 0) < 0.5) continue
    ctx.beginPath()
    ctx.arc((1 - p.x) * w, p.y * h, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }

  const usesHead = checkId === 'head-target'
  const touch = usesHead ? [mid(lms[LM.leftEar], lms[LM.rightEar])] : [lms[LM.leftWrist], lms[LM.rightWrist]]
  if (state?.targetX != null) {
    for (const p of touch) {
      if (!p || Number.isNaN(p.x)) continue
      const x = (1 - p.x) * w
      const y = p.y * h
      ctx.beginPath()
      ctx.arc(x, y, 13, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x, y, 7, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.fill()
    }
  }

  if (state?.targetX != null && state.targetY != null) {
    const cx = (1 - state.targetX) * w
    const cy = state.targetY * h
    const r = targetRadius(checkId ?? '') * w
    const near = touch.length ? Math.min(...touch.filter(Boolean).map((p) => Math.hypot((1 - p.x) * w - cx, p.y * h - cy))) : Infinity
    const close = Math.max(0, Math.min(1, 1 - (near - r) / (r * 2.5)))

    ctx.lineWidth = 5
    ctx.strokeStyle = `rgba(125, 220, 190, ${0.55 + close * 0.45})`
    ctx.fillStyle = `rgba(125, 220, 190, ${0.12 + close * 0.3})`
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
}