# Cadence — Foundation Document

This document captures the day-zero thinking behind Cadence: the vision, the rubric, the technical-feasibility analysis, and the product values that fall out of both.

It exists so that as the project evolves, the *why* behind early decisions stays legible — to me, to anyone I bring in, and to anyone reading the public version of this story later.

---

## 1. Vision

### What Cadence is

A personal speaking coach that lives on my phone. Tap a button when I start talking — a meeting, a presentation, a practice run — and tap again when I stop. That's it. The app handles everything else.

In the background it transcribes what I said, analyzes it for patterns — clarity, hedging, word choice, the moments where I trailed off — and stores it. Every weekday morning I get a short email with observations from the previous day. Not generic advice, but specific patterns from my own voice: what's improving, what's stuck, and one thing to focus on.

Over time it builds a picture of how I communicate. Not from a single session, but across everything I've recorded.

### Why I'm building it

English is my second language and I've always felt my accent and speaking patterns hold me back in high-stakes situations. I want **data, not feelings.** This app should tell me objectively whether I'm improving and exactly where to focus.

The lens is **becoming more effective at my job and moving into leadership positions.** Communication is the single highest-leverage skill at that altitude, and it's the one that's hardest to get honest feedback on.

### Why it's more complex than my last project

My last project, Tripsmith, was text in and text out — type a destination, get a trip plan. This is a different category. Cadence handles audio files, processes them in the background while I get on with my day, stores recordings in a way that lets it find patterns across weeks of data, and runs automated tasks on a schedule without anyone doing anything. These are the building blocks of serious AI products — the kind of infrastructure that sits behind apps millions of people use every day.

### What I'll learn

I'll be working with **audio processing, background job pipelines, vector databases, and scheduled automation** for the first time. Each is a new technical primitive — not just a harder version of something I already know, but a new way of thinking about how software works.

The goal isn't just to build something cool. It's to show up as a PM who understands how AI products are actually made.

---

## 2. The Rubric

Cadence scores each session across seven dimensions on a 1–5 scale. The dimensions were chosen specifically for **leadership communication** — what matters in high-stakes rooms where the bar moves from "did you make yourself understood" to "did you carry conviction."

For each dimension below: a one-line question that defines it, the signals the analyzer looks for, and anchors for every point on the 1–5 scale. The middle anchors (2–4) matter more than the extremes because most real sessions land there.

### 2.1 Clarity

*Could a listener restate your main point in one sentence?*

**Signals:** presence of a thesis or ask, cohesion between sentences, setup-before-payoff structure.

- **1** — No discernible main point. Listener wouldn't know what to take away.
- **2** — Point exists but is buried; partial reconstruction possible with effort.
- **3** — Point is there but unevenly supported; lands on second pass, not first.
- **4** — Clear point, mostly well-supported; minor digressions.
- **5** — One unmistakable takeaway; every sentence reinforces it.

### 2.2 Conciseness

*Did you use roughly the right number of words for the idea?*

**Signals:** throat-clearing openings ("so basically what I'm saying is..."), restating the same point 2–3 ways, tangents that don't return, words-per-idea.

- **1** — Could have been said in half the words with no loss.
- **2** — Significant padding; multiple restatements of the same point.
- **3** — Some padding or one notable tangent, but the message lands.
- **4** — Lean, with one or two ornamental phrases.
- **5** — Every sentence is doing work.

### 2.3 Confidence

*Did your language commit to a position?*

**Signals:** hedging ("I think maybe", "kind of", "sort of"), trailing sentences, statements framed as questions, declarative vs. interrogative sentence shape.

- **1** — Heavy hedging; the language hides what you actually believe.
- **2** — Frequent hedging; positions feel provisional.
- **3** — Mix of committed and hedged statements; net unclear.
- **4** — Mostly committed; occasional hedging where appropriate.
- **5** — You state your view and own it without overcommitting.

> **Note:** Confidence is *language-level*. Composure is *pressure-level*. They fail differently — you can be confident in 1:1s and lose composure under exec scrutiny. They're scored separately.

### 2.4 Composure

*Did you stay steady under pressure, interruption, or challenge?*

**Signals:** rate-of-speech spike when challenged, "um/uh" clustering after a hard question, voice pitch rise, sentences shortening and losing verbs, filler-heavy recoveries.

- **1** — Visibly destabilized; lost the thread.
- **2** — Steadiness slipped at challenge points; speech sped up or fragmented.
- **3** — Held together but the room could feel the strain.
- **4** — Largely steady; brief recalibration moments.
- **5** — Pressure didn't change your delivery — same pace, same shape, same precision.

> **N/A rule:** Score N/A if no genuine pressure or challenge moment occurred in the session. Otherwise this dimension artificially boosts the average on easy 1:1s and the signal is lost. Solo practice runs are always N/A.

### 2.5 Word precision

*Did you reach for the specific word, or settle for a vague one?*

**Signals:** "stuff/things/like that", over-reliance on "very/really/super", missed sharper verbs and nouns.

- **1** — Heavy reliance on filler nouns and intensifiers; meaning lives in gestures, not words.
- **2** — Several vague placeholders that could have been specific.
- **3** — Mix of precise and lazy choices.
- **4** — Mostly precise; occasional fallback.
- **5** — Word choice carries the meaning; listener could quote you.

### 2.6 Tone fit

*Did your register match the context?*

**Signals:** too casual for an exec setting, too stiff for a 1:1, emotional temperature vs. topic.

- **1** — Tone fights the message or the room.
- **2** — Noticeably off-register at multiple moments.
- **3** — Generally appropriate; one or two miscalibrations.
- **4** — Tone matches context well throughout.
- **5** — Tone actively reinforces the message.

> **Context requirement:** This dimension requires the session-type tag at capture time (1:1 / meeting / presentation / practice). Without it, "appropriate register" is undefined.

### 2.7 Intelligibility

*Could the listener catch every word without effort?*

**Signals:** swallowed word-ends, rushed consonants, compressed syllables, pacing on key words.

- **1** — Listener regularly loses words; meaning has to be inferred.
- **2** — Several moments where the listener must work to catch a word.
- **3** — Mostly intelligible; certain phonemes or fast moments require effort.
- **4** — Clear throughout; minor compression on familiar phrases.
- **5** — Every word lands; pacing emphasizes the words that matter.

> **Reframe from "accent":** This dimension explicitly is *not* about sounding native. Some of the most respected execs have strong accents (Sundar, Satya, Indra Nooyi, Jensen) — what didn't cap them was their intelligibility, not their accent. Optimizing for "accent" is mimicry of a moving target; optimizing for intelligibility is targeted work on pronunciation, pacing, and emphasis.

---

## 3. Technical Confidence Assessment

A rubric is only as good as the tech that can grade it. Each dimension was scored on a 1–10 confidence scale for how reliably current tech (transcription + LLM + audio analysis) can measure it.

| # | Dimension | Confidence | Reasoning |
|---|---|:---:|---|
| 1 | **Word precision** | **9/10** | Pure text. LLMs are textbook-strong at detecting vague nouns and weak verbs. Can even suggest the sharper word. |
| 2 | **Clarity** | **9/10** | Text-only. LLMs excel at "what's the main point?" — failure mode (no clear point) is detectable by asking the model to summarize and noting when it struggles. |
| 3 | **Conciseness** | **9/10** | Text-only. Words-per-idea is quasi-objective. Restatement and tangent detection is in LLM range. |
| 4 | **Confidence (language)** | **8/10** | Hedging detection, declarative vs. interrogative shape — LLM strength. Slight ding because some signals (upspeak) are prosodic, not textual. |
| 5 | **Tone fit** | **6/10** | Model can catch obvious mismatches if given the session type. Cannot read the room (audience history, political context, response in the moment). Structurally limited. |
| 6 | **Composure** | **5/10** | Mechanics exist (speech-rate spike, filler clustering after challenge). The real problem is **data availability** — practice runs and solo sessions don't contain pressure moments. |
| 7 | **Intelligibility** | **5/10** | Counterintuitive: **Whisper is so good it masks the problem.** It often correctly transcribes mumbled words a human listener would have missed. Reliable scoring needs Whisper word-confidence + audio features + ideally a stricter ASR for disagreement zones. Closer to research than build-it-in-a-weekend. |

### Pattern that falls out

The four high-confidence dimensions (Clarity, Conciseness, Confidence, Word precision) are all **LLM-on-transcript**. Cheap, fast, reliable.

The three lower-confidence dimensions each fail for a different reason:

- **Tone fit (6)** — *context-poor.* Model doesn't know your audience or your history with them.
- **Composure (5)** — *data-poor.* Most recordings won't contain a pressure moment.
- **Intelligibility (5)** — *tool-paradox.* The best ASR makes the problem invisible.

### Design implications

1. **Build v1 around the four 8–9s.** Get the full pipeline (capture → transcribe → LLM analyze → store → digest) working end-to-end with just those. Learn whether the *system* works and get useful daily feedback within weeks.
2. **Ship Tone fit with a humble label.** Mark scores with explicit "limited by context" framing. Don't promise more than the tech delivers.
3. **Auto-N/A Composure** for sessions tagged "practice" or "solo." Only score for "meeting" and "presentation," and only if a pressure moment is detected.
4. **Defer Intelligibility to v2.** In v1, ship the simpler version: flag low-Whisper-confidence words as "possibly unclear pronunciation moments." Useful, modest, no audio pipeline needed.

### One bigger reframe worth keeping visible

The highest-confidence dimensions are also the most *language-y* — Clarity, Conciseness, Word precision — which are closer to "writing well" than "speaking well." The speaking-specific signals (Composure, Intelligibility, prosodic Confidence) are exactly the ones the tech struggles with. That's a real limitation of any transcript-first approach. It informs both the product values (next section) and the long-term technical roadmap (audio-level analysis is where real differentiation will eventually come from).

---

## 4. Product Values: Calibrated Honesty

### The competitive landscape

The closest comparable tools are **Yoodli** (Google spin-out), **Poised** (real-time during calls), and **Orai** (mobile practice). Otter, Fireflies, and Read aren't really in this category — they're transcription + meeting notes, not speaking coaches.

What's common across the actual comparables:

- They focus on the **easy-to-measure stuff**: filler words, speech rate, weak words, conciseness, pace. All transcript-level. All high-confidence on our scale.
- They report **opaque composite scores** ("confidence: 7.4") without exposing what was actually measured vs. estimated.
- They don't separate **measurable contexts from unmeasurable ones**: a 7.4 confidence score from a solo practice run looks identical to one from a high-stakes exec meeting, even though the underlying data quality is wildly different.
- They almost never say **"this dimension wasn't measurable for this session."** They smooth it into the average.

The technical roadblocks we identified are not unique to Cadence — they're industry-wide. The other tools have either ignored them, masked them with composite scoring, or hand-waved them in fine print.

### The product value

> **Cadence is honest about what it can and can't measure. The honesty isn't a disclaimer — it's the product.**

This is defensible positioning for two reasons:

1. **Audience match.** The target user — ambitious PMs, leaders, anyone trying to improve high-stakes communication — is exactly the demographic that respects calibrated honesty more than confident bullshit. They're people who, in their own work, are trying to communicate with more precision. A coach that mirrors that value is more trustworthy than one that performs confidence.
2. **The constraint becomes the brand.** The limits of the tech are not weaknesses to apologize for; they're a product position to lean into. Beli did this with restaurants ("no stars, only relative rankings"); Headspace with meditation tracking. The constraint becomes the identity.

### How calibrated honesty operationalizes

It can't just be a marketing line — it has to be baked into how the product works:

1. **Per-dimension confidence labels in the UI.** Not "Confidence: 7/10" but "Confidence: 7/10 (high tool reliability)" vs. "Composure: 6/10 (low — limited pressure in this session)." The reader instantly knows which scores to weight.

2. **N/A as a feature, not a bug.** Composure marked N/A on solo practice is *more useful* than a fake 7/10. It tells you something: this session didn't test that dimension. Existing tools won't do this because it breaks their composite scores.

3. **A short methodology page.** One page, no marketing fluff — explains how each dimension is judged and where the limits live. The kind of page Stripe or Linear writes. The existence of the page is itself the signal.

4. **Trend over point-in-time.** A low-confidence dimension can still move directionally. Even if today's composure score is noisy, the 4-week trend tells you something real. Sell the trend, downweight the individual scores.

5. **One "high-confidence headline" in every digest.** Something like: *"Of the things I can measure most reliably, your weakest dimension today was X — here's the example."* The reader immediately knows which feedback to weight most.

6. **The score is calibrated; the delivery voice is tunable.** These are two independent axes and must never be collapsed. The *score* reflects an honest read against the rubric and is never softened to be likable — softening it is exactly "the trap to avoid" below. The *coaching prose* that explains the score can flex in register (blunt vs. encouraging) without changing a single number. A 2/5 phrased as "this meandered and never landed" and a 2/5 phrased as "the point is in here — it took ~40s to surface; lead with it next time" are equally honest. This separation is what lets Cadence meet a demotivated user with a gentler voice while still refusing to lie about where they stand. (Operationalized as the coaching-tone setting; see `plan.md`.)

### The trap to avoid

Transparency only earns retention if the product is **genuinely sharper than competitors on the four dimensions Cadence can measure well.** The honesty earns trust; the depth earns retention. Both have to land. If we lean on "we're honest about our limits" without delivering substantively better feedback on Clarity, Conciseness, Confidence, and Word precision, the framing reads as an excuse.

### The digest design that falls out

- Every digest shows **all seven dimensions** (with their scores and confidence labels).
- The body of the digest **goes deep on the best and the worst** for that session — with quoted examples from the transcript.
- The weekly view shows **trends** for each dimension.
- N/A dimensions are shown as N/A with a one-line reason.

---

## 5. Open Questions and Next Steps

### Validate before building

Before any pipeline work, **score 3+ real recordings against the rubric manually.** If the rubric is internally consistent (you'd give the same scores tomorrow) and forces sharper thinking than vibes-based self-review, it's ready. If dimensions blur into each other or scores feel arbitrary, sharpen first.

### Architecture decisions still to make

- **Mobile stack** — native (Swift) vs. cross-platform (React Native, Flutter, Expo).
- **Backend stack** — what hosts the job pipeline, storage, scheduled tasks.
- **Audio storage** — long-term retention strategy; privacy implications.
- **Transcription provider** — Whisper API vs. self-hosted Whisper vs. alternative (AssemblyAI, Deepgram).
- **Vector DB** — what stores embeddings for cross-session pattern recall.
- **Job queue** — how background analysis is scheduled and tracked.
- **Scheduled digest** — cron infra + email provider.
- **LLM provider for analysis** — Claude vs. GPT vs. mixed.

### Product decisions still to make

- **Session-type tagging UX** — ~~required at capture or auto-inferred?~~ **Resolved:** optional at capture with a `general` default, editable after the fact — protects the tap-and-talk gesture. Pulled out of M11 into its own milestone (M12) since it makes *every* dimension's read context-aware, not just the two that strictly require it. See `plan.md`.
- **Coaching tone** — should feedback delivery be tunable? **Resolved:** yes, a global `Direct ↔ Encouraging` setting that changes prose register only, never scores (see value #6 above). M13.
- **Pressure-moment detection logic** — heuristic, LLM-judged, or self-reported by the user post-session?
- **What "trend" means visually** — line chart, sparkline, single-number delta?
- **Digest delivery time** — when in the morning, and is it a real email or a push notification + in-app surface?
- **First-week onboarding** — how Cadence calibrates to your baseline before it can meaningfully tell you what's "improving."

### A future blog post worth writing

*"Why our speaking coach won't give you a single overall score."* The framing — *AI is often bullshitting, here's how we decided not to* — is timely, substantive, and tied directly to a product the writer actually built. For the goal of "show up as a PM who understands how AI products are actually made," this exact framing is the kind of thinking that gets noticed.
