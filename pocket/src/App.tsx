/**
 * App — 三个屏:有多少时间 → 一节课 → 摄像头教练。
 *
 * 全局规则:用户在进入训练前最多点两下。任何"先配置一下"的界面都不放在主流程里。
 *
 * 🔴 为什么没有日历:
 * 第一版是"导入 .ics → 算出今天的空档 → 选一段"。做完发现方向错了。
 * 采访里用户要的是随时能开始,而"先去导出一个日历文件再导进来"本身就是一次准备工作,
 * 正好撞上第 4 条需求(不用做任何准备)。网页读不到系统日历,所以在网页上"用日历"必然
 * 意味着"先导入",这条路走不通。现在只问用户自己就知道的那件事:现在有多少分钟。
 */

import { useEffect, useMemo, useState } from 'react'
import type { BodyArea, Place } from './lib/movements'
import { composeSession, type Energy } from './lib/session'
import { CameraCoach } from './ui/CameraCoach'
import { PhoneQR } from './ui/PhoneQR'

type Screen = 'time' | 'session' | 'coach'

const AREAS: BodyArea[] = ['neck', 'shoulder', 'back', 'hip', 'knee', 'ankle', 'wrist']

/** 受访者说工作日五到十分钟才现实,更长的被描述为不现实。所以只有这两个。 */
const CHOICES = [5, 10] as const

const THEME_KEY = 'pocket.theme.v1'
type Theme = 'light' | 'dark'

/**
 * 主题。默认浅色,见 styles.css 顶部的理由。选择存本地,刷新不变。
 */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      if (saved === 'light' || saved === 'dark') return saved
    } catch {
      /* 隐私模式下读不到,用默认值 */
    }
    return 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_KEY, theme)
    } catch {
      /* 写不进去不影响使用 */
    }
  }, [theme])
  return [theme, () => setTheme((v) => (v === 'light' ? 'dark' : 'light'))]
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('time')
  const [minutes, setMinutes] = useState(10)
  const [place, setPlace] = useState<Place>('desk')
  const [energy, setEnergy] = useState<Energy>('ok')
  const [sore, setSore] = useState<BodyArea[]>([])
  const [itemIndex, setItemIndex] = useState(0)
  /**
   * 🔴 默认"周围有人"。两种猜错的代价不对等:
   * 猜成"没人"而实际有人 → 课表里出现深蹲,用户直接关掉(测试里观察到的)。
   * 猜成"有人"而实际没人 → 给了一节安静的课,点一下就能换回完整版。
   * 后一种便宜得多。
   */
  const [alone, setAlone] = useState(false)
  const [theme, toggleTheme] = useTheme()

  const session = useMemo(
    () => composeSession({ minutes, place, sore, energy, quietOnly: place !== 'gym', alone }),
    [minutes, place, sore, energy, alone],
  )

  /* ------------------------------------------------------------ screens */

  if (screen === 'coach') {
    const item = session.items[itemIndex]
    if (!item) {
      return (
        <main className="wrap done">
          <h1>That is the session.</h1>
          <p className="muted">
            No score, no streak. That was {minutes} minutes you were not using.
          </p>
          <button className="primary" onClick={() => { setScreen('time'); setItemIndex(0) }}>
            Done
          </button>
        </main>
      )
    }
    return (
      <main className="wrap">
        <CameraCoach
          movement={item.movement}
          onDone={() => setItemIndex((i) => i + 1)}
          onSkip={() => setItemIndex((i) => i + 1)}
        />
        <p className="progress">
          {itemIndex + 1} of {session.items.length}
        </p>
      </main>
    )
  }

  if (screen === 'session') {
    return (
      <main className="wrap">
        <button className="back" onClick={() => setScreen('time')}>← Back</button>
        <h1>{session.headline}</h1>

        <div className="state-row">
          <Chooser label="Where" value={place} onChange={setPlace}
            options={[['desk', 'At my desk'], ['floor', 'On the floor'], ['gym', 'In a gym']]} />
          <Chooser label="Energy" value={energy} onChange={setEnergy}
            options={[['low', 'Low'], ['ok', 'OK'], ['good', 'Good']]} />
        </div>

        <div className="sore">
          <p className="label">Anything sore? Tap it.</p>
          <div className="chips">
            {AREAS.map((a) => (
              <button
                key={a}
                className={sore.includes(a) ? 'chip on' : 'chip'}
                onClick={() => setSore((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}
              >
                {a}
              </button>
            ))}
          </div>
        </div>

        <ol className="plan">
          {session.items.map((it) => (
            <li key={it.movement.id}>
              <div className="plan-top">
                <strong>{it.movement.name}</strong>
                <span className="dose">
                  {it.movement.reps ? `${it.movement.reps} reps` : `${it.movement.seconds}s`}
                </span>
              </div>
              <p className="reason">{it.reason}</p>
              {it.movement.poseCheck && <span className="tag">camera can check this</span>}
            </li>
          ))}
        </ol>

        {session.items.length > 0 && (
          <button className="primary big" onClick={() => { setItemIndex(0); setScreen('coach') }}>
            Start — {session.estimatedMinutes} min
          </button>
        )}
      </main>
    )
  }

  return (
    <main className="wrap">
      <div className="topbar">
        <h1>Pocket</h1>
        <button className="theme-toggle" onClick={toggleTheme}>
          {theme === 'light' ? 'Dark' : 'Light'}
        </button>
      </div>
      <p className="muted">How long have you got right now?</p>

      <ul className="gaps">
        {CHOICES.map((m) => {
          const count = composeSession({
            minutes: m, place, sore, energy, quietOnly: place !== 'gym', alone,
          }).items.length
          return (
            <li key={m}>
              <button onClick={() => { setMinutes(m); setScreen('session') }}>
                <span className="time">{m} minutes</span>
                <span className="len">{count} movements</span>
                <span className="ctx" />
              </button>
            </li>
          )
        })}
      </ul>

      <div className="alone">
        <p className="label">Anyone around?</p>
        <div className="chips">
          <button className={!alone ? 'chip on' : 'chip'} onClick={() => setAlone(false)}>
            People nearby
          </button>
          <button className={alone ? 'chip on' : 'chip'} onClick={() => setAlone(true)}>
            Just me
          </button>
        </div>
        <p className="alone-hint">
          {alone
            ? 'You get the full session.'
            : 'You only get movements that look like stretching at a desk.'}
        </p>
      </div>

      <PhoneQR />

      <p className="fineprint">
        Nothing to set up and nothing to install. Do it in the clothes you are wearing.
        Movement guidance, not medical advice. The camera check runs on this device and no video is
        stored or sent anywhere.
      </p>
    </main>
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
