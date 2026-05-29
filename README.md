# Cadence

A personal speaking coach that lives in your pocket.

Tap to start when you begin speaking — a meeting, a pitch, a practice run. Tap to stop. Cadence transcribes the audio, scores it across six dimensions of communication, and emails you a short read every weekday morning with one specific thing to focus on next.

Try it: **[cadence-five-delta.vercel.app](https://cadence-five-delta.vercel.app)**

---

## What it does

Cadence listens to how you actually communicate and gives you objective, specific feedback on six dimensions of high-stakes spoken communication:

| Dimension | What it asks | Signal source |
|---|---|---|
| **Clarity** | Could a listener restate your main point in one sentence? | Transcript |
| **Conciseness** | Did you use roughly the right number of words for the idea? | Transcript |
| **Confidence** | Did your language commit to a position, or did it hedge? | Transcript |
| **Word precision** | Did you reach for the specific word, or settle for a vague one? | Transcript |
| **Pace** | Were you in the natural speaking range, and did you pause where it mattered? | Whisper word timestamps |
| **Pronunciation clarity** | Could a listener catch every word, or would they have to work? | Whisper per-segment confidence |

Each session gets a 1–5 score per dimension with a short coaching paragraph and two or three **verbatim quoted examples** pulled directly from your own speech.

Every weekday morning, Cadence emails you a short read of yesterday's recordings — your strongest dimension, your weakest, and **one concrete behavioral instruction** to try today, generated specifically from your own patterns.

---

## Why I built it

English is my second language. In high-stakes speaking situations I've always felt my speech patterns hold me back, and I wanted **data, not feelings.**

Most existing speaking-analysis tools (Yoodli, Poised, Orai) focus on the easy-to-measure stuff — filler words, pace, weak words — and mask the limits of their tech behind opaque composite scores. Cadence is built on a different premise: **calibrated honesty** about what the underlying tech can and can't measure.

The lens is becoming more effective at communication — the single highest-leverage skill at any altitude, and the one that's hardest to get honest feedback on.

---

## Status

| Milestone | What it shipped | Status |
|---|---|---|
| **M1** | Single-session loop — audio capture in a PWA, signed-URL upload to Supabase Storage, Whisper transcription, Claude rubric analysis on one dimension | ✅ Shipped |
| **M2** | All four high-confidence dimensions in a single Claude call, focus-of-the-day callout | ✅ Shipped |
| **M3** | Persistence — Postgres schema for sessions/transcripts/analyses, history view, session detail pages | ✅ Shipped |
| **M4** | Daily digest email — Vercel Cron, Resend delivery, structured Claude synthesis | ✅ Shipped |
| **M5** | Multi-user — Supabase Auth (magic links), user-scoped data with Row Level Security, per-user digest recipients, custom verified domain (`coach@paahulhq.com`) | ✅ Shipped |
| UX pass | Editorial design system, custom palette + Newsreader serif, audio playback on session detail, date-grouped home list with score mini-charts, restructured digest email | ✅ Shipped |
| **M6** | Whisper-derived audio signals — adds Pace and Pronunciation Clarity dimensions using Whisper's `verbose_json` timestamps + per-word log-probabilities | 🟡 Next up — addresses real friend feedback that v1 only analyzes the transcript, not the speech |
| **M7** | Background analysis queue — removes the 2-minute recording cap by moving Whisper + Claude off the synchronous request path (Inngest worker, Supabase polling for live status) | ✅ Shipped |
| **M8** | Audio signal processing — adds Intonation, Vocal Energy, and Expressive Range via a Python worker computing pitch contour + RMS curves (Fly.io) | 🟡 Pending — needs M7 first for processing headroom |
| **M9** | Trends + cross-session recall — pgvector, weekly view, trend-aware digest | 🟡 Pending — meaningful only after 3+ weeks of data |
| **M10** | Lower-confidence dimensions (Tone Fit + Composure) with session-type tag + N/A logic | 🟡 Pending |

---

## The product values

**Cadence is honest about what it can and can't measure.** The honesty isn't a disclaimer — it's the product. Practically, that shows up as:

1. **Per-dimension confidence labels** on every score. The reader instantly knows which scores to trust.
2. **N/A as a feature.** Dimensions that aren't measurable for a given session are skipped, not smoothed into the average.
3. **No invented quotes, ever.** Every example shown to the user must appear verbatim in the transcript. Enforced in the rubric prompt and validated server-side via Zod.
4. **The "one thing to focus on" frame.** The daily digest doesn't dump a wall of metrics; it picks the weakest dimension and offers one specific behavioral instruction.

The thinking behind these choices, including the rubric anchors and the technical-feasibility analysis behind which dimensions are measurable, is in [`docs/foundation.md`](docs/foundation.md).

---

## Tech stack

| Layer | Choice |
|---|---|
| Mobile shell | PWA (Next.js App Router, installable to home screen on iOS/Android) |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind 4 |
| Backend | Next.js route handlers — same monorepo deployed as one Vercel project |
| Auth | Supabase Auth (email magic link), custom SMTP via Resend |
| Storage | Supabase Storage (audio files), Supabase Postgres (sessions, transcripts, analyses) |
| Transcription | OpenAI Whisper API |
| Analysis | Claude Sonnet 4.6, structured JSON output validated with Zod |
| Email | Resend, custom `paahulhq.com` domain |
| Cron | Vercel Cron Jobs (weekday 12:00 UTC) |
| Hosting | Vercel |

No queues yet — analysis runs synchronously inside the request. A background job pattern is the next infrastructure primitive to introduce when long recordings start to time out.

---

## Local development

```bash
git clone https://github.com/paahul/cadence.git
cd cadence
npm install
cp .env.example .env.local   # fill in your own keys
npm run dev
```

You'll need accounts at: OpenAI, Anthropic, Supabase, Resend (free tiers cover personal usage). Then run the two SQL migrations in `supabase/migrations/` against your Supabase project's SQL editor.

The `.env.example` file documents every variable Cadence reads. The cron endpoint authenticates via a `CRON_SECRET` Bearer header.

---

## Build plan + design rationale

The full milestone plan and operating principles are in [`plan.md`](plan.md). The product values, the rubric (with all 5 scale anchors per dimension), the technical confidence ranking, and the calibrated-honesty framing are in [`docs/foundation.md`](docs/foundation.md).

---

## A note on this project

Cadence was built over a single extended session as a deliberate next step after [Tripsmith](https://github.com/paahul/tripsmith) — chosen specifically to be more architecturally complex. Tripsmith was text-in, text-out. Cadence handles audio capture, signed-URL upload pipelines, background scheduled work, multi-user data isolation, and cross-session pattern recall as the underlying primitives — the building blocks of real production AI products.

The goal wasn't just to build something cool. It was to show up as a PM who understands how AI products are actually made.
