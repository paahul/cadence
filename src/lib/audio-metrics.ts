/**
 * Extract per-session audio signals from Whisper's verbose_json response.
 *
 * Used by the Pace and Pronunciation Clarity dimensions added in M6.
 * Everything in here comes from data we're already paying for — we just
 * stopped throwing it away.
 */

export type AudioMetrics = {
  durationSeconds: number;
  wordCount: number;
  /** Words per minute, computed against actual speaking time (excluding pre-roll silence). */
  wpm: number;
  pauses: {
    /** Count of inter-word gaps ≥ 0.4s. */
    count: number;
    /** Count of inter-word gaps ≥ 1.0s. */
    overOneSecondCount: number;
    /** Longest single pause, in seconds, rounded to 1 decimal. */
    longestSeconds: number;
    /** Total time spent paused (sum of all gaps ≥ 0.4s). */
    totalPauseSeconds: number;
  };
  /**
   * Whisper segments where the model had below-threshold confidence.
   * Used as a proxy for "the listener would have to work to catch this."
   * Note: this is NOT an accent assessment; it's an intelligibility signal.
   */
  uncertainSegments: Array<{ text: string; avgLogprob: number }>;
};

type WhisperWord = { word: string; start: number; end: number };
type WhisperSegment = {
  start: number;
  end: number;
  text: string;
  avg_logprob: number;
};

// Segments below this avg_logprob are flagged as "uncertain". Whisper's
// avg_logprob is a negative number; closer to 0 means more confident.
const LOW_CONFIDENCE_THRESHOLD = -0.6;

// A "pause" only counts if the gap is at least this long. Anything shorter
// is normal between-word transition time.
const PAUSE_THRESHOLD_SECONDS = 0.4;
const LONG_PAUSE_THRESHOLD_SECONDS = 1.0;

export function extractAudioMetrics(args: {
  words: WhisperWord[];
  segments: WhisperSegment[];
  durationSeconds: number;
}): AudioMetrics {
  const { words, segments, durationSeconds } = args;

  // Speaking time = last_word_end − first_word_start (excludes silence at edges).
  let speakingSeconds = durationSeconds;
  if (words.length >= 2) {
    const first = words[0];
    const last = words[words.length - 1];
    speakingSeconds = Math.max(0.1, last.end - first.start);
  }
  const wpm =
    speakingSeconds > 0 ? Math.round((words.length / speakingSeconds) * 60) : 0;

  // Pause distribution.
  let totalPauseSeconds = 0;
  let pauseCount = 0;
  let overOneSecondCount = 0;
  let longestSeconds = 0;
  for (let i = 1; i < words.length; i += 1) {
    const gap = words[i].start - words[i - 1].end;
    if (gap >= PAUSE_THRESHOLD_SECONDS) {
      pauseCount += 1;
      totalPauseSeconds += gap;
      if (gap >= LONG_PAUSE_THRESHOLD_SECONDS) overOneSecondCount += 1;
      if (gap > longestSeconds) longestSeconds = gap;
    }
  }

  // Uncertain segments — Whisper's avg_logprob as a per-segment confidence proxy.
  const uncertainSegments = segments
    .filter((s) => s.avg_logprob < LOW_CONFIDENCE_THRESHOLD)
    .map((s) => ({
      text: s.text.trim(),
      avgLogprob: s.avg_logprob,
    }))
    // Surface the worst offenders first; cap at 6 to keep the prompt focused.
    .sort((a, b) => a.avgLogprob - b.avgLogprob)
    .slice(0, 6);

  return {
    durationSeconds,
    wordCount: words.length,
    wpm,
    pauses: {
      count: pauseCount,
      overOneSecondCount,
      longestSeconds: Math.round(longestSeconds * 10) / 10,
      totalPauseSeconds: Math.round(totalPauseSeconds * 10) / 10,
    },
    uncertainSegments,
  };
}
