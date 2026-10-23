/**
 * App — 主导航与配置流程。
 *
 * 引入了：
 * 1. CameraCoach 传递的 onBack 中途退出。
 * 2. 漂亮的完成庆祝页面 (Celebration Screen) 及重开/关闭操作。
 * 3. 课表列表专用的【大尺寸】 MiniDiagram，带明确发力方向与视觉引导。
 */

import { useEffect, useMemo, useState } from 'react'
import type { BodyArea } from './lib/movements'
import { byId, type Movement } from './lib/movements'
import { MovementIcon, iconFor } from './ui/MovementIcon'
import { composeSession, fitsBudget, maxSessionMinutes, minutesFor, sessionPool, type Energy } from './lib/session'
import { CameraCoach } from './ui/CameraCoach'

type Screen = 'landing' | 'time' | 'count' | 'session' | 'coach'

const MAX_ITEMS = 12
const THEME_KEY = 'pocket.theme.v1'
type Theme = 'light' | 'dark'

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      // ignore
    }
    return 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      // ignore
    }
  }, [theme])
  return [theme, () => setTheme((v) => (v === 'light' ? 'dark' : 'light'))]
}

// 🔴 全新设计的具象化大尺寸 MiniDiagram
function MiniDiagram({ id }: { id: string }) {
  let content = null

  if (id === 'neck-release') {
    // 歪脖子：明确的头部倾斜 + 下压箭头
    content = (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {/* 肩膀与躯干基准 */}
        <path d="M 15 85 Q 50 75 85 85" stroke="var(--muted)" strokeWidth="5" />
        <path d="M 50 80 V 100" stroke="var(--muted)" strokeWidth="5" />
        {/* 头部向右倾斜 */}
        <g transform="translate(50, 45) rotate(28) translate(-50, -45)">
          <circle cx="50" cy="45" r="18" stroke="var(--muted)" strokeWidth="5" />
          <path d="M 50 63 V 77" stroke="var(--muted)" strokeWidth="5" />
        </g>
        {/* 绿色的倾斜引导虚线和箭头 */}
        <path d="M 45 15 A 35 35 0 0 1 78 45" stroke="var(--accent)" strokeWidth="3" strokeDasharray="5 5" />
        <path d="M 70 48 L 78 45 L 75 37" stroke="var(--accent)" strokeWidth="4" />
      </svg>
    )
  } else if (id === 'shoulder-shrug') {
    // 耸肩：高耸的肩膀轮廓 + 双侧强力向上箭头
    content = (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="50" cy="35" r="15" stroke="var(--muted)" strokeWidth="5" />
        {/* 耸起的肩膀 */}
        <path d="M 15 75 Q 50 55 85 75" stroke="var(--muted)" strokeWidth="5" />
        {/* 双侧绿色向上箭头 */}
        <path d="M 28 65 V 40 M 20 48 L 28 40 L 36 48" stroke="var(--accent)" strokeWidth="4.5" />
        <path d="M 72 65 V 40 M 64 48 L 72 40 L 80 48" stroke="var(--accent)" strokeWidth="4.5" />
      </svg>
    )
  } else if (id === 'desk-leg-press') {
    // 桌下抗阻：桌板横线 + 膝盖上顶 + 橙色的发力警示线
    content = (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {/* 桌子横切面 */}
        <path d="M 10 35 H 90" stroke="var(--muted)" strokeWidth="8" />
        {/* 大腿与小腿 */}
        <path d="M 25 95 L 45 55 L 80 55" stroke="var(--muted)" strokeWidth="5" />
        {/* 橙色的向上推力线 (用 var(--warn) 表示发力对抗) */}
        <path d="M 50 48 V 40 M 45 45 L 50 40 L 55 45" stroke="var(--warn)" strokeWidth="4" />
        <path d="M 70 48 V 40 M 65 45 L 70 40 L 75 45" stroke="var(--warn)" strokeWidth="4" />
      </svg>
    )
  } else if (id === 'focal-shift') {
    // 视距切换：眼睛 + 近处实心点 + 远处视窗，用绿色虚线连接
    content = (
      <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        {/* 眼睛 */}
        <path d="M 10 50 Q 25 35 40 50 Q 25 65 10 50" stroke="var(--muted)" strokeWidth="4" />
        <circle cx="25" cy="50" r="5" fill="var(--muted)" stroke="none" />
        {/* 近处的焦点 */}
        <circle cx="65" cy="75" r="8" stroke="var(--accent)" strokeWidth="3" />
        {/* 远处的窗框/风景 */}
        <rect x="68" y="15" width="22" height="18" rx="3" stroke="var(--accent)" strokeWidth="3" />
        {/* 视觉引导虚线 */}
        <path d="M 45 55 L 56 68" stroke="var(--accent)" strokeWidth="3" strokeDasharray="4 4" />
        <path d="M 42 45 L 63 28" stroke="var(--accent)" strokeWidth="3" strokeDasharray="4 4" />
      </svg>
    )
  }

  if (!content) return null
  
  return (
    <div className="mini-diagram" aria-hidden="true">
      {content}
    </div>
  )
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [minutes, setMinutes] = useState(10)
  const [energy, setEnergy] = useState<Energy>('ok')
  const [itemIndex, setItemIndex] = useState(0)
  const [alone, setAlone] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  
  const [picked, setPicked] = useState<string[] | null>(null)
  const [theme, toggleTheme] = useTheme()

  const NONE_SORE: BodyArea[] = useMemo(() => [], [])

  const maxMin = useMemo(
    () => maxSessionMinutes({ sore: NONE_SORE, energy, alone }),
    [NONE_SORE, energy, alone],
  )

  const effMinutes = Math.min(minutes, maxMin)

  const pool = useMemo(
    () => sessionPool({ minutes: effMinutes, sore: NONE_SORE, energy, alone }),
    [effMinutes, NONE_SORE, energy, alone],
  )

  const session = useMemo(
    () =>
      composeSession({
        minutes: effMinutes, sore: NONE_SORE, energy, alone,
        maxItems: count ?? undefined,
      }),
    [effMinutes, NONE_SORE, energy, alone, count],
  )

  const plan: Movement[] = useMemo(() => {
    if (picked == null) return session.items.map((it) => it.movement)
    const ok = new Set(pool.map((m) => m.id))
    return picked.filter((id) => ok.has(id)).map((id) => byId(id)).filter((m): m is Movement => !!m)
  }, [picked, session, pool])

  const planMinutes = useMemo(() => minutesFor(plan), [plan])

  const overBudget = !fitsBudget(plan, effMinutes)
  const countOk = count == null || plan.length === count
  const canStart = plan.length > 0 && countOk && !overBudget

  function askForCount(n: number | null) {
    setCount(n)
    setPicked(null)
  }

  function togglePick(id: string) {
    setPicked((cur) => {
      const base = cur ?? session.items.map((it) => it.movement.id)
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })
  }

  if (screen === 'landing') {
    return (
      <main className="wrap landing-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div className="hero" style={{ maxWidth: '560px', width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.03em', color: 'var(--ink)' }}>Fit Break</h1>
            <p className="hero-subtitle" style={{ fontSize: '18px', lineHeight: 1.6, color: 'var(--muted)', margin: '0 auto', maxWidth: '460px' }}>
              Exercise in the gaps of a working day. Say how many minutes you have, get one short session that fits.
            </p>
          </div>
          <div className="hero-card" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '24px', padding: '40px 32px', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.08)', textAlign: 'left' }}>
            <ul className="features" style={{ listStyle: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', padding: '12px', borderRadius: '14px', flexShrink: 0, display: 'flex' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '16px', marginBottom: '4px', color: 'var(--ink)' }}>Smart Form Check</strong>
                  <span style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--muted)' }}>Ten of the movements can be checked by your camera. The rest you follow by the cues.</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', padding: '12px', borderRadius: '14px', flexShrink: 0, display: 'flex' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '16px', marginBottom: '4px', color: 'var(--ink)' }}>Context Aware</strong>
                  <span style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--muted)' }}>Tell it if people are around, and it only offers discreet stretching.</span>
                </div>
              </li>
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', padding: '12px', borderRadius: '14px', flexShrink: 0, display: 'flex' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <div>
                  <strong style={{ display: 'block', fontSize: '16px', marginBottom: '4px', color: 'var(--ink)' }}>100% Private</strong>
                  <span style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--muted)' }}>The pose model runs entirely in your browser. No video is ever uploaded.</span>
                </div>
              </li>
            </ul>
            <button 
              className="primary big" 
              style={{ width: '100%', fontSize: '18px', padding: '18px', borderRadius: '16px', fontWeight: 700 }} 
              onClick={() => setScreen('time')}
            >
              Launch Fit Break
            </button>
            <div className="privacy-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--muted)', fontSize: '13px', marginTop: '24px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
              <span>Runs on your device. Nothing leaves your browser.</span>
            </div>
          </div>
        </div>
      </main>
    )
  }

  if (screen === 'coach') {
    const item = plan[itemIndex]
    if (!item) {
      return (
        <main className="wrap landing-wrap" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '100vh', display: 'flex' }}>
          <div className="hero" style={{ maxWidth: '560px', width: '100%' }}>
            <div className="hero-card" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '24px', padding: '48px 32px', boxShadow: 'var(--shadow)', textAlign: 'center' }}>
              <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎉</div>
              <h1 style={{ fontSize: '32px', fontWeight: 750, margin: '0 0 16px' }}>Great Job!</h1>
              <p className="muted" style={{ fontSize: '16px', lineHeight: 1.6, margin: '0 auto 40px', maxWidth: '280px' }}>
                You have completed your {plan.length}-movement break. Thank you for taking care of your body.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button 
                  className="primary big" 
                  style={{ width: '100%', fontSize: '18px', padding: '18px' }} 
                  onClick={() => { setScreen('landing'); setItemIndex(0) }}
                >
                  Start Another Session
                </button>
                <button 
                  className="ghost big" 
                  style={{ width: '100%', fontSize: '18px', padding: '18px', border: '1px solid var(--line)' }} 
                  onClick={() => {
                    try { window.close() } catch(e) {}
                    if (!window.closed) window.location.href = 'about:blank'
                  }}
                >
                  Close Window
                </button>
              </div>
            </div>
          </div>
        </main>
      )
    }

    return (
      <main className="wrap wide">
        <CameraCoach
          movement={item}
          onDone={() => setItemIndex((i) => i + 1)}
          onBack={() => setScreen('session')}
        />
        <p className="progress" style={{ marginTop: '24px' }}>
          {itemIndex + 1} of {plan.length}
        </p>
      </main>
    )
  }

  if (screen === 'session') {
    return (
      <main className="wrap wide">
        {/* 🔴 更新后的样式，放大尺寸，并改善垂直居中对齐 */}
        <style>{`
          .plan-pick {
            grid-template-columns: 16px 26px minmax(0, 1fr) auto !important;
            align-items: center !important; /* 让整体内容垂直居中对齐 */
          }
          .mini-diagram {
            width: 82px; /* 进一步放大容器 */
            height: 82px;
            border-radius: 12px;
            background: color-mix(in srgb, var(--accent) 5%, var(--panel));
            border: 1px solid color-mix(in srgb, var(--accent) 18%, transparent);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: 12px;
            flex-shrink: 0;
            box-shadow: 0 4px 12px -4px color-mix(in srgb, var(--accent) 12%, transparent);
          }
          .mini-diagram svg {
            width: 62px; /* 相应的图形也放大 */
            height: 62px;
          }
        `}</style>

        <button className="back" onClick={() => setScreen('count')}>← Back</button>
        <h1>
          {plan.length} movement{plan.length === 1 ? '' : 's'}.{' '}
          {alone ? 'Short enough to fit the gap.' : 'None of them look like exercising.'}
        </h1>

        <div className="state-row">
          <Chooser label="Energy" value={energy} onChange={setEnergy}
            options={[['ok', 'Normal'], ['low', 'Low today']]} />
        </div>

        <p className="pick-head">
          {count == null ? (
            <>Filling the time. Tap to swap anything out.</>
          ) : plan.length === count ? (
            <><b>{plan.length} of {count} chosen.</b> Tap to swap anything.</>
          ) : plan.length < count ? (
            <><b className="short">{plan.length} of {count} chosen.</b> Pick {count - plan.length} more to carry on.</>
          ) : (
            <><b className="short">{plan.length} of {count} chosen.</b> Take {plan.length - count} back out.</>
          )}
          {picked != null && (
            <button className="linky" onClick={() => setPicked(null)}>Use the suggested set</button>
          )}
        </p>

        {overBudget && (
          <p className="summary warn">
            That is about {planMinutes} minutes, and you said you had {effMinutes}. Take{' '}
            {planMinutes - effMinutes === 1 ? 'a minute' : `${planMinutes - effMinutes} minutes`}{' '}
            worth back out, or go back and ask for longer.
          </p>
        )}

        <ol className="plan">
          {pool.map((m) => {
            const on = plan.some((p) => p.id === m.id)
            const order = plan.findIndex((p) => p.id === m.id) + 1
            return (
              <li key={m.id} className={on ? 'picked' : 'unpicked'}>
                <button
                  className="plan-pick"
                  aria-pressed={on}
                  onClick={() => togglePick(m.id)}
                  title={on ? 'Take this one out' : 'Put this one in'}
                >
                  <span className="plan-order">{on ? order : ''}</span>
                  <MovementIcon name={iconFor(m)} size={20} />
                  <span className="plan-body">
                    <span className="plan-top">
                      <strong>{m.name}</strong>
                      {m.poseCheck && (
                        <span className="cam-dot" title="The camera can check this one">
                          <CameraGlyph />
                        </span>
                      )}
                      <span className="dose">{m.reps ? `${m.reps} reps` : `${m.seconds}s`}</span>
                    </span>
                    {m.loads.length > 0 && (
                      <span className="plan-loads">{m.loads.join(' · ')}</span>
                    )}
                    <span className="plan-cues">{m.cues[0]} · {m.cues[1]}</span>
                  </span>
                  
                  {/* 🔴 在右侧挂载对应动作的大号迷你图解 */}
                  <MiniDiagram id={m.id} />

                </button>
              </li>
            )
          })}
        </ol>

        {pool.length > 0 && (
          <button
            className="primary big"
            style={{ width: '100%', fontSize: '18px', padding: '18px', marginTop: '24px' }}
            disabled={!canStart}
            onClick={() => {
              if (itemIndex >= plan.length) setItemIndex(0)
              setScreen('coach')
            }}
          >
            {itemIndex > 0 && itemIndex < plan.length
              ? 'Resume Session'
              : `Start — ${planMinutes} min`}
          </button>
        )}
      </main>
    )
  }

  if (screen === 'time') {
    return (
      <main className="wrap">
        <button className="back" style={{ fontSize: '16px', padding: '8px 0' }} onClick={() => setScreen('landing')}>
          ← Back
        </button>
        
        <div className="topbar" style={{ marginTop: '8px' }}>
          <div className="section" style={{ margin: 0, fontSize: '15px' }}>Step 1 of 2</div>
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'light' ? 'Dark' : 'Light'}
          </button>
        </div>
        
        <h1 style={{ marginTop: '8px', fontSize: '32px' }}>Your setup</h1>

        <div className="field" style={{ marginTop: '28px' }}>
          <span className="label" style={{ fontSize: '16px', fontWeight: 650, color: 'var(--ink)' }}>
            What kind of movements?
          </span>
          <div className="chips" style={{ marginTop: '12px' }}>
            <button 
              className={!alone ? 'chip on' : 'chip'} 
              style={{ fontSize: '16px', padding: '12px 18px' }} 
              onClick={() => setAlone(false)}
            >
              Unnoticeable
            </button>
            <button 
              className={alone ? 'chip on' : 'chip'} 
              style={{ fontSize: '16px', padding: '12px 18px' }} 
              onClick={() => setAlone(true)}
            >
              Normal
            </button>
          </div>
          <p className="alone-hint" style={{ fontSize: '15px', marginTop: '14px', lineHeight: 1.5 }}>
            {alone
              ? 'Full movements. Includes standing up and larger stretches.'
              : 'Small, unnoticeable movements. You stay in your chair.'}
          </p>
        </div>

        <label className="field" style={{ marginTop: '36px' }}>
          <span className="label" style={{ fontSize: '16px', fontWeight: 650, color: 'var(--ink)' }}>
            How much time do you have?
          </span>
          <div className="field-row" style={{ marginTop: '16px' }}>
            <input
              type="range"
              min={1}
              max={maxMin}
              value={effMinutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
            />
            <output style={{ fontSize: '18px', fontWeight: 700 }}>{effMinutes} min</output>
          </div>
        </label>

        <button 
          className="primary big" 
          style={{ marginTop: '48px', fontSize: '18px', padding: '18px', width: '100%' }} 
          onClick={() => setScreen('count')}
        >
          Next Step →
        </button>
      </main>
    )
  }

  if (screen === 'count') {
    return (
      <main className="wrap">
        <button className="back" style={{ fontSize: '16px', padding: '8px 0' }} onClick={() => setScreen('time')}>
          ← Back
        </button>

        <div className="topbar" style={{ marginTop: '8px' }}>
          <div className="section" style={{ margin: 0, fontSize: '15px' }}>Step 2 of 2</div>
        </div>
        
        <h1 style={{ marginTop: '8px', fontSize: '32px' }}>How many movements?</h1>

        <div className="field" style={{ marginTop: '28px' }}>
          <div className="field-row">
            <input
              type="range"
              min={1}
              max={MAX_ITEMS}
              value={count ?? plan.length}
              onChange={(e) => askForCount(Number(e.target.value))}
            />
            <output style={{ fontSize: '18px', fontWeight: 700 }}>{count ?? plan.length}</output>
          </div>
          <p className="alone-hint" style={{ fontSize: '15px', marginTop: '16px' }}>
            {count === null
              ? 'Filling the time you have. Drag to set it yourself.'
              : <button className="linky" style={{ fontSize: '15px' }} onClick={() => askForCount(null)}>Fill the time instead</button>}
          </p>
        </div>

        <div style={{ marginTop: '48px' }}>
          {plan.length === 0 ? (
            <p className="summary warn" style={{ fontSize: '16px', lineHeight: 1.5 }}>
              Nothing fits in {minutes} min. Try going back and adding more time.
            </p>
          ) : (
            <>
              <p className="summary" style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700 }}>
                {plan.length} movement{plan.length === 1 ? '' : 's'}, about {planMinutes} min
              </p>
              {count != null && plan.length < count && (
                <p className="summary warn" style={{ margin: '-10px 0 20px', fontSize: '15px' }}>
                  You asked for {count}. Only {plan.length} suit this setting.
                </p>
              )}
              <button 
                className="primary big" 
                style={{ width: '100%', fontSize: '18px', padding: '18px' }} 
                onClick={() => setScreen('session')}
              >
                See the session
              </button>
            </>
          )}
        </div>
      </main>
    )
  }

  return null
}

function CameraGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5h3.5L8 6.5h8l1.5 2H21v11H3z" />
      <circle cx="12" cy="14" r="3.4" />
    </svg>
  )
}

function Chooser<T extends string>({
  label, value, onChange, options,
}: {
  label: string
  value: T
  onChange: (v: T) => void
  options: Array<[T, string]>
}) {
  return (
    <div className="chooser">
      <p className="label">{label}</p>
      <div className="chips">
        {options.map(([v, text]) => (
          <button key={v} className={value === v ? 'chip on' : 'chip'} onClick={() => onChange(v)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  )
}