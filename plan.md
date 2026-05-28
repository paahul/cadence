# Cadence Build Plan

A milestone-sequenced plan for shipping Cadence v1. The principle is **end-to-end thin slice first** — get the full loop working with one dimension, then thicken each layer in turn.

## Operating principles

1. **Ship end-to-end before thickening any layer.** M1 produces a working single-dimension analyzer. Don't add the second dimension until the loop works.
2. **Introduce each primitive when its absence hurts, not before.** No queue until analyses time out. No vector DB until trends require it. The point is to learn *why* each primitive exists by feeling its absence first.
3. **Boring stack, deliberate.** Weekend time goes into the rubric prompt and the analyzer, not into infrastructure exotica.
4. **Calibrated honesty stays at the front.** Every UI surface that shows a score also shows its confidence label. This is a design constraint, not a feature.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (PWA) | Next.js (App Router) | Ecosystem fit, easy PWA via manifest |
| Backend | Same Next.js app — API routes / server actions | One repo, one deploy unit |
| Hosting | Vercel | Best Next.js host, built-in cron, has blob storage |
| Database | Postgres on Supabase | You already use Supabase on Tripsmith — same auth, same client, pgvector available at M5 |
| Audio storage | Supabase Storage | Same product as the DB; one fewer dashboard and SDK to wrangle |
| Transcription | OpenAI Whisper API | ~$0.006/min, no infra to run |
| LLM analysis | Claude API | Strong on rubric/structured judgment |
| Email | Resend | Modern, simple, free tier sufficient |
| Queue | Deferred | Synchronous analysis in M1; introduce when timeouts force it |
| Vector DB | Deferred | Introduce at M5 via the pgvector extension on the existing Supabase Postgres |

## Milestones

### M1 — Single-session loop

**Deliverable:** A working PWA that records audio, uploads it, transcribes it, runs Word Precision analysis, and displays the result.

**Components:**
- PWA shell: Next.js app, manifest, install-to-home-screen, minimal styling
- Recording UI: tap-start / tap-stop button, Wake Lock active during recording, elapsed timer
- Audio upload to Supabase Storage via signed URL
- Transcription: server-side Whisper API call; store transcript text
- Analysis: server-side Claude call with the Word Precision rubric; return structured JSON (score 1–5, reasoning, 2–3 quoted examples)
- Result view: score + confidence label + reasoning + quoted examples

**Success criteria:**
- Record a 60-second clip on your phone, hit stop, see a Word Precision score with examples within ~30 seconds
- When you self-score the same clip blind against the rubric, you agree with Cadence's score (±1 point)

**Estimated effort:** 2 weekends.

**Key risks:**
- Whisper API latency on long clips → cap M1 recordings at 5 minutes
- Wake Lock unavailable on older iOS → degrade gracefully with a "keep your screen on" warning

### M2 — Four high-confidence dimensions

**Deliverable:** Same loop, but analysis covers Clarity, Conciseness, Confidence, and Word Precision. Result view shows all four with confidence labels.

**Components:**
- One analyzer prompt that returns all four dimensions as structured JSON (not four separate calls)
- Per-dimension UI cards (score, confidence label, reasoning, examples)
- "High-confidence headline" component: one prominent callout for the weakest dimension, marked as the focus for the day

**Success criteria:**
- Full four-dimension analysis runs reliably within ~45 seconds
- Self-scoring agreement: you agree with Cadence on 3 out of 4 dimensions for most sessions

**Estimated effort:** 1 weekend.

**Key risks:**
- Prompt drift across dimensions → enforce a single shared rubric schema, not per-dimension prompts

### M3 — Persistence and history

**Deliverable:** Sessions persist. You can see a list of past sessions and revisit any of them.

**Components:**
- Supabase Postgres with the typed `@supabase/supabase-js` client (matches your Tripsmith pattern — no new ORM to learn)
- Schema: `users`, `sessions`, `transcripts`, `analyses`
- Session list view (latest first) + session detail view
- Single-user hardcoded — no login flow yet

**Success criteria:**
- 10+ sessions stored without data loss
- Session list loads in <500ms
- Any past session re-openable with its full analysis

**Estimated effort:** 1 weekend.

### M4 — Daily digest email

**Deliverable:** Every weekday morning, you get an email summarizing yesterday's recordings with the best/worst dimension callouts.

**Components:**
- Vercel Cron Job at 7am ET, Mon–Fri
- Digest generator: pulls yesterday's sessions, picks best + worst dimension across them, generates email body via Claude
- Resend for delivery
- Empty-day handling: skip the email if no recordings yesterday (don't shame the user)

**Success criteria:**
- Email arrives within 5 minutes of 7am ET on 5 consecutive weekdays
- "Best" and "worst" callouts feel sensible relative to the underlying analyses
- The email is readable in under 60 seconds

**Estimated effort:** 1 weekend.

**Key risks:**
- Silent cron failure → add a self-ping (e.g., POST to a healthcheck service) inside the cron handler so you find out the same day if it stops firing

### M5 — Trends and cross-session recall

**Deliverable:** A weekly view shows your dimension scores over time. The digest can reference trends ("Your conciseness improved 0.6 points over the last three weeks").

**Components:**
- `pgvector` extension enabled on the existing Supabase Postgres
- Per-session embedding stored for semantic recall ("sessions where you hedged a lot")
- Trend computation: rolling average per dimension over a configurable window
- Weekly view: sparklines per dimension
- Digest prompt updated to reference trends when meaningful data exists

**Success criteria:**
- Trends only surface after 5+ sessions in a dimension (avoids noisy early signal)
- "Show me sessions where I was confident" returns semantically relevant results

**Estimated effort:** 1–2 weekends.

### M6 — Lower-confidence dimensions

**Deliverable:** Tone Fit, Composure, plus the N/A logic. Each ships with explicit calibrated-honesty UI.

**Components:**
- Session-type tag at capture time (1:1 / meeting / presentation / practice)
- Tone Fit scorer with explicit "limited by context" framing in the UI
- Composure scorer with N/A logic: only scores sessions tagged `meeting` or `presentation` *and* with a detected pressure moment
- Pressure-moment detection: LLM-judged on transcript (interruptions, hard questions, pushback)
- "N/A — this session didn't test this dimension" UI treatment

**Success criteria:**
- Composure correctly N/A's solo sessions
- Tone Fit scores feel sensible across at least three different session types

**Estimated effort:** 1–2 weekends.

### M7 — Intelligibility (deferred / v2)

**Deliverable:** Pronunciation-level feedback using Whisper word-confidence + simple audio-level features.

This is explicitly v2 work. The v1 placeholder: surface low-Whisper-confidence words as "possibly unclear pronunciation moments." Useful, modest, requires no audio-processing pipeline.

## Explicitly NOT in v1

- Authentication / multi-user (single hardcoded user)
- App Store deployment / native shell
- Real-time live analysis during a call
- Audio-level prosodic analysis beyond Whisper confidence
- Social or sharing features
- Multi-language support (English only)
- Live transcription (post-hoc only)
- Custom-trained models (off-the-shelf APIs only)

## Open decisions before starting M1

1. **API accounts:**
   - OpenAI (Whisper) — *new*
   - Anthropic (Claude) — already in use on Tripsmith
   - Vercel (hosting + cron) — create a new project for Cadence
   - Supabase (Postgres + Storage) — already in use on Tripsmith; create a new project for Cadence
   - Resend (email, deferrable until M4) — already in use on Tripsmith
2. **Domain** — start with `cadence-<something>.vercel.app`; custom domain is optional and can come later
3. **Spending budget** — set a monthly cap. Personal usage of Whisper + Claude should be well under $10/month at expected volume
4. **Repo structure** — single Next.js app at repo root for now; refactor only if there's a clear reason

## The very next thing to do

Create the API accounts, set up `.env.local`, and scaffold the Next.js app skeleton in this repo. Get a "hello world" PWA installable to your phone's home screen. That's the start of M1.
