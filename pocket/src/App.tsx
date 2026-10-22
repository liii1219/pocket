/**
 * App — 主导航与配置流程。
 *
 * 引入了：
 * 1. CameraCoach 传递的 onBack 中途退出。
 * 2. 漂亮的完成庆祝页面 (Celebration Screen) 及重开/关闭操作。
 */

import { useEffect, useMemo, useState } from 'react'
import type { BodyArea } from './lib/movements'
import { byId, targetsSoreArea, type Movement } from './lib/movements'
import { MovementIcon, iconFor } from './ui/MovementIcon'
import { composeSession, fitsBudget, maxSessionMinutes, minutesFor, sessionPool, type Energy } from './lib/session'
import { CameraCoach } from './ui/CameraCoach'

type Screen = 'landing' | 'time' | 'count' | 'session' | 'coach'

const AREAS: BodyArea[] = ['neck', 'shoulder', 'back', 'hip', 'knee', 'ankle', 'wrist']
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

export default function App() {
  const [screen, setScreen] = useState<Screen>('landing')
  const [minutes, setMinutes] = useState(10)
  const [energy, setEnergy] = useState<Energy>('ok')
  const [sore, setSore] = useState<BodyArea[]>([])
  const [itemIndex, setItemIndex] = useState(0)
  const [alone, setAlone] = useState(false)
  const [count, setCount] = useState<number | null>(null)
  /**
   * 用户自己挑的动作。null = 用系统排的那一套。
   * 🔴 默认 null,所以不想挑的人还是点一下就能开始 —— 第 3、4 条需求
   * (立刻开始、不用准备)不能因为加了自主权就丢掉。挑是可选的,不是必经的一步。
   */
  const [picked, setPicked] = useState<string[] | null>(null)
  const [theme, toggleTheme] = useTheme()

  const maxMin = useMemo(
    () => maxSessionMinutes({ sore, energy, alone }),
    [sore, energy, alone],
  )

  const effMinutes = Math.min(minutes, maxMin)

  /** 这套设置下所有能做的动作,和系统挑选时同一批、同一个顺序 */
  const pool = useMemo(
    () => sessionPool({ minutes: effMinutes, sore, energy, alone }),
    [effMinutes, sore, energy, alone],
  )

  /**
   * 标酸痛拿掉了几个动作。
   *
   * 🔴 用户自己挑动作之后,这组按钮唯一还在做的事就是"在你挑之前先把会压到痛处的
   * 拿下去" —— 而这件事做完之后列表只是悄悄变短,看不出来发生过。
   * 不说清楚,这组按钮就显得没用了。所以把数字摆出来。
   */
  const hiddenBySore = useMemo(
    () =>
      sore.length === 0
        ? 0
        : sessionPool({ minutes: effMinutes, sore: [], energy, alone }).length - pool.length,
    [effMinutes, sore, energy, alone, pool],
  )

  const session = useMemo(
    () =>
      composeSession({
        minutes: effMinutes, sore, energy, alone,
        maxItems: count ?? undefined,
      }),
    [effMinutes, sore, energy, alone, count],
  )

  /**
   * 最终要练的动作。
   * 🔴 用户挑过之后,设置一变(标了酸痛、切了精力)挑过的东西可能已经不能做了。
   * 这里按当前 pool 过滤一遍,不让一个已被排除的动作留在课表里。
   */
  const plan: Movement[] = useMemo(() => {
    if (picked == null) return session.items.map((it) => it.movement)
    const ok = new Set(pool.map((m) => m.id))
    return picked.filter((id) => ok.has(id)).map((id) => byId(id)).filter((m): m is Movement => !!m)
  }, [picked, session, pool])

  const planMinutes = useMemo(() => minutesFor(plan), [plan])

  /**
   * 能不能开始。两道关,少一道都不行:
   * - 要了几个就得挑几个(自动模式没要数,这一关不设)
   * - 🔴 挑的东西必须放得进你说的时间。
   *   自动模式原来完全不拦,于是十分钟的空档可以挑满十四个动作,
   *   按钮上写着 "Start — 13 min" —— 你自己填的时长被当成没说过。
   */
  const overBudget = !fitsBudget(plan, effMinutes)
  const countOk = count == null || plan.length === count
  const canStart = plan.length > 0 && countOk && !overBudget

  function togglePick(id: string) {
    setPicked((cur) => {
      const base = cur ?? session.items.map((it) => it.movement.id)
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
    })
  }

  /* ------------------------------------------------------------ screens */

  if (screen === 'landing') {
    return (
      <main className="wrap landing-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div className="hero" style={{ maxWidth: '560px', width: '100%', textAlign: 'center' }}>
          
          {/* 头部标题区：放大字号，增加呼吸感 */}
          <div style={{ marginBottom: '40px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 800, margin: '0 0 16px', letterSpacing: '-0.03em', color: 'var(--ink)' }}>Pocket</h1>
            <p className="hero-subtitle" style={{ fontSize: '18px', lineHeight: 1.6, color: 'var(--muted)', margin: '0 auto', maxWidth: '460px' }}>
              Exercise in the gaps of a working day. Say how many minutes you have, get one short session that fits.
            </p>
          </div>

          {/* 核心功能卡片：更柔和的阴影，更舒展的布局 */}
          <div className="hero-card" style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '24px', padding: '40px 32px', boxShadow: '0 20px 40px -12px rgba(0,0,0,0.08)', textAlign: 'left' }}>
            <ul className="features" style={{ listStyle: 'none', padding: 0, margin: '0 0 40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
              
              <li style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                {/* 🔴 图标容器：添加了透明主题色背景，加粗了图标线条 */}
                <div style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)', padding: '12px', borderRadius: '14px', flexShrink: 0, display: 'flex' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                {/* 文字拆分为上下结构 */}
                <div>
                  <strong style={{ display: 'block', fontSize: '16px', marginBottom: '4px', color: 'var(--ink)' }}>Smart Form Check</strong>
                  {/* 🔴 25 个动作里只有 10 个有判定器。写成"用摄像头数次数"是承诺了做不到的事 —— 
                      模拟展示上被点出来的就是这类。说清楚哪些能查、剩下的怎么办。 */}
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
            
            {/* 按钮更圆润，字体更粗 */}
            <button 
              className="primary big" 
              style={{ width: '100%', fontSize: '18px', padding: '18px', borderRadius: '16px', fontWeight: 700 }} 
              onClick={() => setScreen('time')}
            >
              Launch Pocket
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

  // 🔴 全新的庆祝结束界面
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
                You have completed your {session.items.length}-movement break. Thank you for taking care of your body.
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
                    // 浏览器安全策略拦截 window.close 时的兜底处理：跳转到空白页
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
      // 🔴 教练屏也用宽版心。指导栏搬到画面旁边之后,560px 的版心把画面挤到 290px 宽,
      //    骨架和圆圈都看不清 —— 主角反而被配角挤没了。
      <main className="wrap wide">
        <CameraCoach
          movement={item}
          onDone={() => setItemIndex((i) => i + 1)}
          onBack={() => setScreen('session')} // 🔴 从这里退回列表
        />
        <p className="progress" style={{ marginTop: '24px' }}>
          {itemIndex + 1} of {plan.length}
        </p>
      </main>
    )
  }

  // 列表/详情概览
  if (screen === 'session') {
    return (
      // 🔴 课表这一屏用宽版心。560px 的单栏容器塞不下两列,
      //    九个动作就只能竖着排一长条 —— 这正是用户抱怨要滑半天的原因。
      <main className="wrap wide">
        <button className="back" onClick={() => setScreen('count')}>← Back</button>
        {/*
          🔴 标题读的是 plan,不是 session。
          原来写死 session.headline —— 用户挑到十四个,标题还在说"9 movements"。
        */}
        <h1>
          {plan.length} movement{plan.length === 1 ? '' : 's'}.{' '}
          {alone ? 'Short enough to fit the gap.' : 'None of them look like exercising.'}
        </h1>

        <div className="state-row">
          <Chooser label="Energy" value={energy} onChange={setEnergy}
            options={[['ok', 'Normal'], ['low', 'Low today']]} />
        </div>

        <div className="sore">
          {/*
            🔴 这组按钮原来用的是和"Normal""Just me"同一个绿色选中态。
            绿色读起来是"好的/正常",所以点亮一个绿色的 knee 完全可能被理解成
            "膝盖没问题" —— 实际意思正相反。用户测试里第一个问题就是
            "我点了是有还是没有"。
            三处改:选中态换成警示色、按钮自己说出"sore"、下面再写一句谁被标了。
          */}
          <p className="label">Where does it hurt today? Tap anything sore.</p>
          <div className="chips">
            {AREAS.map((a) => {
              const marked = sore.includes(a)
              return (
                <button
                  key={a}
                  className={marked ? 'chip sore on' : 'chip sore'}
                  aria-pressed={marked}
                  onClick={() => setSore((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
                >
                  {a}
                  {marked && <span className="chip-tag">sore</span>}
                </button>
              )
            })}
          </div>
          <p className="sore-summary">
            {sore.length === 0 ? (
              'Nothing marked. Tap a part only if it hurts today — anything that would load it is then taken off the list below.'
            ) : hiddenBySore > 0 ? (
              <>
                <b>{hiddenBySore} movement{hiddenBySore === 1 ? '' : 's'} taken off the list</b>{' '}
                because {sore.length === 1 ? 'it would' : 'they would'} load your {sore.join(', ')}.
                Gentle movement for {sore.length === 1 ? 'it' : 'them'} is still there.
              </>
            ) : (
              <>Nothing in the list loads your {sore.join(', ')}, so it all stays.</>
            )}
          </p>
        </div>

        {/*
          🔴 候选全列出来,用户自己勾。
          系统挑的那几个**预先勾好** —— 不想挑的人点一下 Start 就走,
          第 3、4 条需求(立刻开始、不用准备)还在;想换的人直接点就能换。
          只有在上一屏明确要了个数的时候,才要求数量对上才能前进。
        */}
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
                    {targetsSoreArea(m, sore).length > 0 ? (
                      <span className="plan-cues why">
                        Gentle movement for the {targetsSoreArea(m, sore).join(' and ')} you marked
                        sore. It does not load it.
                      </span>
                    ) : (
                      <span className="plan-cues">{m.cues[0]} · {m.cues[1]}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        {pool.length > 0 && (
          // 🔴 智能按钮：如果中途退出，按钮变为 Resume 继续
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
              value={count ?? session.items.length}
              onChange={(e) => setCount(Number(e.target.value))}
            />
            <output style={{ fontSize: '18px', fontWeight: 700 }}>{count ?? session.items.length}</output>
          </div>
          <p className="alone-hint" style={{ fontSize: '15px', marginTop: '16px' }}>
            {count === null
              ? 'Filling the time you have. Drag to set it yourself.'
              : <button className="linky" style={{ fontSize: '15px' }} onClick={() => setCount(null)}>Fill the time instead</button>}
          </p>
        </div>

        <div style={{ marginTop: '48px' }}>
          {session.items.length === 0 ? (
            <p className="summary warn" style={{ fontSize: '16px', lineHeight: 1.5 }}>
              Nothing fits in {minutes} min. Try going back and adding more time.
            </p>
          ) : (
            <>
              <p className="summary" style={{ margin: '0 0 20px', fontSize: '20px', fontWeight: 700 }}>
                {session.items.length} movements, about {session.estimatedMinutes} min
              </p>
              {session.shortfall === 'pool' && (
                <p className="summary warn" style={{ margin: '-10px 0 20px', fontSize: '15px' }}>
                  Only {session.items.length} movements suit this setting.
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


/** 课表里那个小摄像头。只说明"这条能被检查",不占一整行。 */
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