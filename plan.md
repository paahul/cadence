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

### M5 — Open to friends (multi-user + custom domain)

**Deliverable:** Other people can sign up, record their own sessions, and receive their own daily digest at their own email. Cadence stops being a personal project and becomes shareable.

**Components:**
- **Auth:** Supabase Auth (email magic link is cheapest UX) or similar — replace the hardcoded single user
- **User-scoped data model:** add `user_id` to `sessions`, enforce RLS so users only see their own sessions
- **Per-user digest recipient:** the cron pulls each user's sessions independently and emails them at their own address (replaces the single `CADENCE_DIGEST_RECIPIENT` env var)
- **Custom domain in Resend:** verify a real domain (e.g., a subdomain of something Paahul owns), set up SPF/DKIM, swap `onboarding@resend.dev` → `coach@<domain>`. ~10 min of DNS work in the Resend dashboard
- **Invite flow:** simple — share a sign-up link; whoever clicks creates an account

**Why this milestone now (pulled forward from M8 → M5):** Trends (formerly M5, now M6) need weeks of data to be useful, so they don't lose value by waiting. Multi-user, on the other hand, gates real-world feedback from friends — pulling it forward maximizes the time Cadence is being used by more than one person.

**Why this milestone exists at all:** Resend's `onboarding@resend.dev` only delivers to the account owner. Moving to a verified domain is the prerequisite for sending email to anyone other than Paahul, which is the prerequisite for inviting friends.

**Paired Tripsmith work:** Tripsmith has a related email bug (share-button sends to Paahul instead of the dynamic recipient — likely the same `from`-address constraint). When the Cadence M5 domain work lands, pair it with a Tripsmith pass to verify a domain, swap Tripsmith's `from`, and confirm dynamic recipients work end-to-end. See `~/.claude/projects/-Users-paahulsikand-projects-tripsmith/memory/tripsmith_email_bug.md` for context.

**Estimated effort:** 2–3 weekends — auth alone is a chunk, and the RLS/data-model migration deserves care.

### M6 — Whisper-derived audio signals (Pace + Pronunciation Clarity)

**Deliverable:** Two new dimensions that finally let Cadence analyze the *speech*, not just the transcript. Addresses real friend feedback that v1 only reads what was said, not how it was said.

**Why this is next:** Friend feedback (verbatim): *"ye speech padta hai bas, thoda intonation and voice pe bi feedback deni chaiye and pronunciation. it analyses transcript, it should analyse the speech too."* Fair critique. Lowest-cost path to addressing it is to use signals we're already paying for and currently discarding — Whisper's `verbose_json` response includes per-word timestamps and per-word log-probabilities. No new service, no new infra. Just a different `response_format` parameter and some downstream computation.

**Components:**
- Change Whisper call to `response_format=verbose_json` (same model, same cost, richer output)
- Extract from the response:
  - Per-word timestamps → words-per-minute, pause distribution, sentence-end durations
  - Per-word `logprob` → confidence-of-recognition per word as a pronunciation-clarity proxy
  - Filler-word counts and disfluencies (false starts, repeated words) via regex on the transcript
- Add two new rubric dimensions, both at **high tool reliability**:
  - **Pace** — WPM ranges with anchors (150–180 is the standard speaking range; below 130 reads as draggy; above 200 reads as rushed). Also surfaces pause patterns.
  - **Pronunciation Clarity** — flags specific words a listener would have to work to catch. Framed as *intelligibility*, never as accent. Explicitly does NOT compare against native-speaker references.
- Result UI: each new dimension gets the same card pattern as the existing four; pronunciation examples link back to the specific word in the transcript

**Success criteria:**
- A clip you self-record at 240 WPM scores significantly worse on Pace than the same content at 170 WPM
- Words you deliberately mumble are flagged in Pronunciation Clarity examples
- The rubric still discriminates across all six dimensions (the prompt doesn't collapse into noise)

**Estimated effort:** ~3–4 hours. The Whisper response shape changes; the rubric prompt grows by two dimensions; the schema gains two more `dimensionResult` keys. No infrastructure work.

**Why this comes before M7 (queue):** The queue is invisible to the user; the new audio dimensions are immediately visible. Friend feedback was about the *product*, not the constraint. Ship product value first.

### M7 — Background analysis queue (remove the 2-min cap) ✅ Shipped

**Deliverable:** Recordings can be any length. The 2-minute cap in the Recorder goes away. Analyses run in the background after stop.

**Why this exists:** Vercel hobby's 60-second function timeout caps the synchronous `/api/analyze` path. A real meeting recording (5–15 min) blows through that. Today's band-aid is a client-side 2:00 cap with a visible "Max 2:00 per session" hint and an auto-stop. That hint is a promise to the user that the constraint is temporary.

**Components:**
- `analysis_status` enum + `analysis_error` text column on the `sessions` table (or a separate `analysis_jobs` table — TBD). Values: `pending` / `processing` / `completed` / `failed`.
- `/api/analyze` becomes a two-phase endpoint:
  - Phase 1 (synchronous, fast): create the session row with `analysis_status = 'pending'`, return `{ sessionId }` immediately
  - Phase 2 (background): a worker picks up the pending row and runs Whisper + Claude, then writes the transcript + analysis + flips status to `completed`
- **Worker runtime** — pick one:
  - **Inngest** (recommended) — dedicated job queue with retries, observability, generous free tier, clean Next.js SDK
  - Trigger.dev — similar shape, alternative if Inngest's pricing changes
  - Vercel Cron tick every minute that drains the queue — simplest but adds up-to-60s latency to every analysis
  - A Fly.io / Render worker polling the queue table — overkill for this scale
- Client changes:
  - `/sessions/[id]` becomes status-aware. If `pending`/`processing`, render a "Working" state mirroring the current recorder checklist
  - Subscribe to Supabase Realtime on the session row for live updates, or fall back to polling every 2s
  - Recorder removes the 2:00 cap, the timer-format change, the progress bar's urgent state, and the "Max 2:00 per session" hint
- Failure UX: when `status = 'failed'`, show the error on the session page with a "Re-run analysis" button that re-enqueues

**Success criteria:**
- A 10-minute recording analyzes successfully end-to-end without any client-side cap
- Median analysis turnaround is under 90 seconds wall-clock for a 5-minute clip
- A failed analysis is visible (not silently lost) and recoverable via re-enqueue

**Estimated effort:** 3–4 hours of focused work. The Inngest setup is mostly boilerplate; the schema migration + Realtime subscription pattern is the real work.

**Trigger to pull this in:** Either (a) you find a real friend repeatedly bumping into the 2-min cap, or (b) you're about to ship Cadence beyond friends-and-family. Whichever comes first.

**Gotchas learned shipping this:**
- **The Vercel-Inngest integration's auto-sync uses per-deploy URLs**, not the canonical custom domain. Per-deploy URLs (e.g. `cadence-abc123-paahul-s-projects.vercel.app`) have Vercel Deployment Protection on by default, which 401s Inngest's sync `PUT`. The failed syncs show up in Inngest's dashboard under "Unattached syncs" with the misleading message "could not reach your URL" — but the URL is fine, the protection layer is the problem.
- **Fix: manually sync the app from the Inngest dashboard pointing at the canonical URL** (`https://cadence.paahulhq.com/api/inngest`). The custom domain doesn't have deployment protection. Manual sync becomes the source of truth.
- **Inngest's `serve()` handler returns `{"message": "Unauthorized"}` on unauthenticated GET requests in production mode.** This is correct/expected behavior, not a bug. Don't waste 15 minutes thinking the handler is broken because a browser visit returns Unauthorized — it's locked down by design.
- **The `inngest` npm package's `createFunction` signature changed**: the trigger now lives inside the first config argument as a `triggers` array, not as a separate second argument. Old docs showing `createFunction(config, { event: "..." }, handler)` are stale; the current signature is `createFunction({ id, triggers: [{ event: "..." }], ... }, handler)`.

### M8 — Audio signal processing (Intonation, Vocal Energy, Expressive Range)

**Deliverable:** Three dimensions that come from the audio waveform itself, not from text. The half of the friend feedback that Whisper signals can't reach.

**Why this exists:** Pace and pronunciation are *language-level* signals — they live in what Whisper returns. Intonation, energy, and expressive range live in the *waveform*. A speaker can be perfectly paced and clear-spoken and still deliver everything in a flat monotone or trail off at every sentence-end. Cadence should catch that.

**Components:**
- A Python audio-processing worker, running outside Vercel (Fly.io is the cheapest credible host, ~$5/mo) — Vercel's serverless runtime doesn't fit Python signal-processing libs well
- The worker exposes an HTTP endpoint that takes a Supabase storage path and returns:
  - Pitch contour stats: F0 range, variability, sentence-end pitch movement (extracted via `pyworld` or `parselmouth`)
  - Energy/RMS curve: sentence-end energy drop, overall stability
  - Voice activity detection: speaking-time ratio vs. pauses
- `/api/analyze` (running on the background queue from M7) calls the Python worker before Claude. The waveform-derived stats become inputs to the rubric prompt.
- Three new rubric dimensions, all at **medium tool reliability**:
  - **Intonation** — was the delivery expressive, or monotone?
  - **Vocal Energy** — did your voice stay steady, or trail off at sentence-ends?
  - **Expressive Range** — did the pitch and energy work together to signal emphasis, or was the whole recording uniform?
- Result UI: each gets its own card, same calibrated-honesty confidence label pattern as the existing dimensions

**Why this comes after M7 (queue):** Adding 10–15s of audio processing per session to the synchronous request path would push the 60s timeout even harder. M7 makes processing time invisible to the user; this milestone uses that runway.

**Success criteria:**
- A deliberately-monotone recording scores meaningfully worse on Intonation than the same content delivered with normal variance
- Sentence-end trail-off is flagged in Vocal Energy
- The Python worker's median per-file processing time is under 12 seconds

**Estimated effort:** 1–2 weekends. The Fly.io worker setup is the most novel piece; pitch/energy extraction is well-trodden territory in the audio-processing ecosystem.

**Explicitly NOT in this milestone — and not planned at all:**
- Phoneme-level pronunciation analysis comparing the speaker to native references. That goes against the calibrated-honesty positioning (Cadence is not about sounding native), and pulls the product into research territory. The Pronunciation Clarity dimension from M6 covers what's defensibly measurable; we stop there.

### M9 — Trends and cross-session recall

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

### M10 — Lower-confidence dimensions (Tone Fit + Composure)

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

## Explicitly NOT in v1

- Authentication / multi-user (single hardcoded user) — *moved to M5, not cut*
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
