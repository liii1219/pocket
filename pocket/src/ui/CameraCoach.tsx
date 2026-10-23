/**
 * CameraCoach — 一次一个动作的摄像头页面。
 *
 * 引入了明确的执行状态机 (execState) 来区分 准备/进行中/完成。
 * 彻底修复了切换动作时语音“串台”复读的 Bug。
 * 摄像头模式现在也有了明确的 Start 按钮和进行中视觉反馈，不再暗中强制开始了。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Movement } from '../lib/movements'
import { CHECK_SETUP, CHECKERS, initState, targetRadius, type CheckOutput, type CheckState } from '../lib/pose/checkers'
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
  onBack: () => void 
}

export function CameraCoach({ movement, onDone, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const camCanvasRef = useRef<HTMLCanvasElement>(null)
  const [blur, setBlur] = useState(true)
  
  const [voiceOn, setVoiceOn] = useState(true)
  const [manualMode, setManualMode] = useState(false)
  const [manualRep, setManualRep] = useState(0)

  const [blurMode, setBlurMode] = useState<'mask' | 'outline' | 'none'>('none')
  const stateRef = useRef<CheckState>(initState())
  const [out, setOut] = useState<CheckOutput | null>(null)

  const [execState, setExecState] = useState<'ready' | 'running' | 'finished'>('ready')
  const [left, setLeft] = useState(movement.seconds ?? 0)

  const lastSpokenCue = useRef<string | null>(null)
  const lastSpokenRep = useRef<number>(-1)
  const announcedIdRef = useRef<string | null>(null)
  const finishedSpokenRef = useRef<string | null>(null)
  const halfSpokenRef = useRef<string | null>(null)

  // 🔴 核心修复：Derived State 衍生状态同步更新法
  // 在组件 Render 阶段直接侦测 ID 变化并同步重置所有状态，彻底阻断老状态泄漏到下一次渲染，根除语音串台 Bug
  const [prevMovementId, setPrevMovementId] = useState(movement.id)
  if (movement.id !== prevMovementId) {
    setPrevMovementId(movement.id)
    setExecState('ready')
    setOut(null)
    setManualMode(false)
    setManualRep(0)
    setLeft(movement.seconds ?? 0)
    
    stateRef.current = initState()
    lastSpokenCue.current = null
    lastSpokenRep.current = -1
    announcedIdRef.current = null
    finishedSpokenRef.current = null
    halfSpokenRef.current = null
    
    // 立刻强行掐断上一句话的残影
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }

  const checker = movement.poseCheck ? CHECKERS[movement.poseCheck] : null
  const target = movement.reps ?? 0
  const timed = movement.seconds != null && movement.reps == null
  const isManual = !checker || manualMode

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

  // 结课观察器
  useEffect(() => {
    if (execState !== 'running') return
    if (timed && left === 0) {
      setExecState('finished')
    } else if (!timed && !isManual && target > 0 && out && out.reps >= target) {
      setExecState('finished')
    } else if (!timed && isManual && target > 0 && manualRep >= target) {
      setExecState('finished')
    }
  }, [execState, timed, left, isManual, target, out, manualRep])

  // 计时器驱动
  useEffect(() => {
    if (!movement.seconds || execState !== 'running') return
    const timerId = window.setInterval(() => {
      setLeft((v) => Math.max(0, v - 1))
    }, 1000)
    return () => clearInterval(timerId)
  }, [movement.seconds, execState])

  // 手动计数驱动
  useEffect(() => {
    if (execState !== 'running' || !isManual || timed) return
    const timerId = window.setInterval(() => {
      setManualRep(r => r + 1)
    }, 3500)
    return () => clearInterval(timerId)
  }, [execState, isManual, timed])

  const speak = useCallback((text: string) => {
    if (!voiceOn || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 1.05
    window.speechSynthesis.speak(u)
  }, [voiceOn])

  // 语音：新动作引导
  useEffect(() => {
    if (announcedIdRef.current !== movement.id && voiceOn) {
      let text = `${movement.name}. `
      if (movement.reps) text += `Do ${movement.reps} reps. `
      if (movement.seconds) text += `Hold for ${movement.seconds} seconds. `
      text += `${movement.cues[0]}. ${movement.cues[1]}.`
      
      speak(text)
      announcedIdRef.current = movement.id
    }
  }, [movement.id, movement.name, movement.reps, movement.seconds, movement.cues, speak, voiceOn])

  // 语音：完成鼓励
  useEffect(() => {
    if (execState === 'finished' && voiceOn && finishedSpokenRef.current !== movement.id) {
       speak('Done. Excellent work.')
       finishedSpokenRef.current = movement.id
    }
  }, [execState, voiceOn, movement.id, speak])

  // 语音：倒计时半程与冲刺
  useEffect(() => {
    if (!timed || !voiceOn || execState !== 'running') return
    const total = movement.seconds ?? 0
    const half = Math.floor(total / 2)
    
    if (left === half && half >= 10 && halfSpokenRef.current !== movement.id) {
       halfSpokenRef.current = movement.id
       const ENCOURAGEMENTS = ["Keep breathing.", "Hold it there.", "Looking good."]
       const cheer = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]
       speak(`Halfway there. ${cheer}`)
    } 
    else if (left === 10 && total > 15 && halfSpokenRef.current !== movement.id + '10s') {
       halfSpokenRef.current = movement.id + '10s'
       speak('Just 10 seconds left. Almost there.')
    } 
  }, [left, timed, voiceOn, execState, movement.seconds, speak, movement.id])

  // 语音：手动模式计数
  useEffect(() => {
    if (!voiceOn || !isManual || timed || manualRep === 0 || execState !== 'running') return
    if (manualRep === lastSpokenRep.current) return
    lastSpokenRep.current = manualRep
    if (target > 0 && manualRep >= target) return

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
  }, [manualRep, isManual, timed, target, voiceOn, movement.cues, speak, execState])

  // 语音：摄像头模式计数
  useEffect(() => {
    if (!voiceOn || isManual || timed || !out || execState !== 'running') return
    
    if (out.counted && out.reps !== lastSpokenRep.current) {
      lastSpokenRep.current = out.reps
      if (target > 0 && out.reps >= target) return

      if (out.cue) {
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
  }, [out, timed, voiceOn, isManual, target, speak, execState])

  // Ready 状态下强制数字显示 0，防止瞎试动作导致幽灵计数
  const reps = execState === 'ready' ? 0 : isManual ? manualRep : (out?.reps ?? 0)

  const feedback = useMemo(() => {
    if (out == null) {
      return movement.poseCheck
        ? CHECK_SETUP[movement.poseCheck]
        : 'Stand where the camera can see you.'
    }
    if (!out.confident) return out.cue ?? 'I cannot see you well enough to check this.'
    if (out.cue) return out.cue
    return out.phase === 'down' ? 'Hold, then come back up.' : 'Good. Keep going.'
  }, [checker, out, movement.poseCheck])

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

  // 🔴 纯语音 / 纯动作视图渲染
  if (!checker || manualMode) {
    return (
      <div className="coach">
        <button className="back" style={{ fontSize: '16px', padding: '0 0 16px 0' }} onClick={() => { stop(); onBack(); }}>
          ← Back
        </button>

        {head}
        <MovementDiagram movementId={movement.id} checkId={movement.poseCheck} />
        
        <div className="readout" style={{ justifyContent: 'center', margin: '20px 0', flexDirection: 'column', gap: '16px' }}>
          <div className="count" style={{ fontSize: '64px' }}>
            {timed ? (
              <><strong style={{ color: execState === 'finished' ? 'var(--accent)' : 'inherit'}}>{left}</strong><span style={{ fontSize: '32px' }}>s</span></>
            ) : (
              <><strong style={{ color: execState === 'finished' ? 'var(--accent)' : 'inherit'}}>{reps}</strong><span style={{ fontSize: '32px' }}> / {target}</span></>
            )}
          </div>
          
          {execState === 'ready' && (
            <button 
              className="primary" 
              style={{ padding: '12px 36px', fontSize: '18px', borderRadius: '999px', margin: '0 auto' }} 
              onClick={() => {
                 stateRef.current = initState();
                 setOut(null);
                 setManualRep(0);
                 setLeft(movement.seconds ?? 0);
                 setExecState('running');
              }}
            >
              Start Movement
            </button>
          )}

          {execState === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '18px' }}>
              <style>{`
                @keyframes pulse-dot {
                  0% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.4; transform: scale(0.85); }
                  100% { opacity: 1; transform: scale(1); }
                }
              `}</style>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.5s infinite ease-in-out' }} />
              In progress
            </div>
          )}

          {execState === 'finished' && (
            <div style={{ color: 'var(--accent)', fontWeight: 650, fontSize: '20px' }}>
              Completed!
            </div>
          )}
        </div>

        <p className="no-check" style={{ textAlign: 'center' }}>
          {manualMode 
            ? 'Camera check is off. Follow the pace and voice cues.'
            : 'Follow the two cues. There is no camera check for this one.'}
        </p>
        <p className="stop-if">{movement.stopIf}</p>
        <div className="actions">
          <button 
            className={execState === 'finished' ? "primary" : "ghost"} 
            onClick={() => { stop(); onDone(); }}
            style={execState !== 'finished' ? { border: '1px solid var(--line)' } : undefined}
          >
            {execState === 'finished' ? 'Done — next movement' : 'Skip movement'}
          </button>
        </div>
      </div>
    )
  }

  // 🔴 摄像头检测视图渲染
  return (
    <div className="coach">
      <button className="back" style={{ fontSize: '16px', padding: '0 0 16px 0' }} onClick={() => { stop(); onBack(); }}>
        ← Back
      </button>

      {head}

      <div className="stage-row">
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

        <aside className="guide">
          <MovementDiagram movementId={movement.id} checkId={movement.poseCheck} />
          <ol className="guide-cues">
            <li>{movement.cues[0]}</li>
            <li>{movement.cues[1]}</li>
          </ol>
        </aside>
      </div>

      <div className="readout">
        <div className="count">
          {timed ? (
            <>
              <strong style={{ color: execState === 'finished' ? 'var(--accent)' : 'inherit'}}>{left}</strong>
              <span>s</span>
            </>
          ) : (
            <>
              <strong style={{ color: execState === 'finished' ? 'var(--accent)' : 'inherit'}}>{reps}</strong>
              {target > 0 && <span> / {target}</span>}
            </>
          )}
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, justifyContent: 'center', gap: '8px' }}>
          {/* 明确的 Start 按钮，取代之前的暗中发车 */}
          {execState === 'ready' && status === 'running' && (
            <button 
              className="primary" 
              style={{ padding: '8px 24px', fontSize: '15px', borderRadius: '999px', alignSelf: 'flex-start' }} 
              onClick={() => {
                stateRef.current = initState();
                setOut(null);
                setLeft(movement.seconds ?? 0);
                setExecState('running');
              }}
            >
              Start Movement
            </button>
          )}

          {execState === 'running' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)', fontWeight: 600, fontSize: '15px' }}>
              <style>{`
                @keyframes pulse-dot {
                  0% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.4; transform: scale(0.85); }
                  100% { opacity: 1; transform: scale(1); }
                }
              `}</style>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse-dot 1.5s infinite ease-in-out' }} />
              In progress
            </div>
          )}

          {execState === 'finished' ? (
             <p className="feedback" style={{ color: 'var(--accent)', fontWeight: 650, margin: 0 }}>Completed! Excellent work.</p>
          ) : status === 'running' ? (
             <p className={out && !out.confident ? 'feedback unsure' : 'feedback'} style={{ margin: 0 }}>{feedback}</p>
          ) : (
             <p className="feedback" style={{ color: 'var(--muted)', margin: 0 }}>Turn on the camera to begin.</p>
          )}
        </div>
      </div>

      {status === 'running' && (
        <p className="readout-meta">
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
          className={execState === 'finished' ? "primary" : "ghost"}
          onClick={() => {
            stop()
            onDone()
          }}
          style={execState !== 'finished' ? { border: '1px solid var(--line)' } : undefined}
        >
          {execState === 'finished' ? 'Done — next movement' : 'Skip movement'}
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