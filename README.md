# Pocket

Exercise in the gaps of a working day.

You say how many minutes you have right now. You get one short session sized to fit.
The camera checks you are doing the movement correctly. Nothing to install, no account,
and the video never leaves your browser.

Built for DECO2850 Interaction Design at the University of Queensland.

---

## Two versions

| | What it is | Lines |
|---|---|---|
| [`pocket-mvp/`](pocket-mvp/) | Single HTML file. Double-click it and it runs. No build, no install, works offline. No camera. | 141 |
| [`pocket/`](pocket/) | Full prototype. React + TypeScript + Vite, with camera-based movement checking. | 1,600 |

### Run the MVP

Open `pocket-mvp/index.html` in a browser. That is the whole thing.

### Run the full version

```bash
cd pocket
npm install     # also copies the MediaPipe wasm into public/
npm run dev
```

Open `http://localhost:5173`. The camera needs `localhost` or HTTPS.

```bash
npm test        # 34 tests
```

---

## Why it works this way

The design came out of four semi-structured interviews with people in full-time work or
study. The transcripts were coded with an affinity diagram. Five requirements came out of
that, and every decision below traces back to one of them.

**1. The free time already exists and is not used.** Every participant could point to
gaps in their working day. None of them used those gaps for exercise. The product does
not create time, it makes existing time usable.

**2. Five to ten minutes is the realistic length.** Longer was described as unrealistic,
not as undesirable. So those are the only two options.

**3. It has to start on the spot.** No booking, no planning the night before. An earlier
version read the user's calendar to find their gaps, and that turned out to be a mistake —
a browser cannot read the system calendar, so "use your calendar" really meant "export a
file and import it first", which is preparation. It was removed.

**4. No preparation.** The barrier people described was never the exercise. It was
changing clothes, finding space, finding equipment. Every movement in the library is
marked with whether it can be done in work clothes, how much floor space it needs, and
whether it makes noise.

**5. The guidance has to be right.** Participants could not tell whether they were
performing a movement correctly, and one had given up on online instruction because
different videos contradicted each other. This is what the camera is for.

## Deliberately not built

| Not built | Why |
|---|---|
| Streaks | Participants described working weeks that break. A streak turns a normal gap into a failure. |
| Weight, BMI, calories | Ethics commitment, and it conflicts with what people said about not understanding metrics. |
| A dashboard | Two participants rejected wearables for the same reason: one more thing to interpret. |
| Setting up a schedule first | The hard moment is starting. Configuration loads work onto the most fragile point. |
| A browsable exercise library | "If I only have ten minutes, I don't want to spend five of them choosing." |

---

## How the camera check works

MediaPipe Tasks Vision runs a pose model **in the browser**. The wasm and the model are
served from `public/`, so it works with no network connection. Frames go to a `<video>`
element and memory only — nothing is uploaded and nothing is written to disk.

| What it can judge | How |
|---|---|
| Rep count | A state machine on the main joint angle, with hysteresis so a wobble at the threshold does not double-count |
| Squat depth | The **minimum** knee angle reached during the rep, which has to drop below 110° |
| Moving too fast | Time per rep. Under 1.2 seconds gets a "slow down" |
| Hip hinge vs knee bend | Trunk lean against hip angle. If the trunk is still upright it says to push the hips back |
| Shoulder range | The maximum raise angle within the rep |

One cue at a time, ordered safety → range → tempo, and only at the moment a rep finishes.
It never interrupts mid-movement. When it cannot see clearly it says so instead of
guessing.

### Known limits

- **2D landmarks cannot see the lumbar spine.** The hinge check judges overall trunk
  angle, not whether the lower back is rounding. Real detection would need a depth camera
  or an inertial sensor on the lower back.
- Knee valgus cannot be detected. That needs a front view plus depth.
- A side or 45° view is most accurate. Face-on flattens the knee angle.
- On a phone over a LAN address the browser blocks the camera, because that is not a
  secure context.

---

## Code layout

```
pocket/src/lib/      pure functions, no runtime imports, vitest runs them directly
  movements.ts       the movement library and its constraints
  session.ts         minutes + state -> a session
  pose/angles.ts     landmark geometry
  pose/checkers.ts   the movement state machines
pocket/src/ui/       runtime only, no business logic
  usePose.ts         camera + MediaPipe
  CameraCoach.tsx    the coach screen
pocket/src/App.tsx   three screens
```

The split exists so the business logic can be tested without a browser, and so it could
move to React Native unchanged.

---

## Privacy

No account. No analytics. No server. The camera stream stays in the page and is discarded
when you leave it.
