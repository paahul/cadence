import type { FullSession } from "./db";
import type { DigestStats, Synthesis } from "./digest";
import { DIMENSIONS } from "./rubric/dimensions";
import type { AnalysisResult } from "./rubric/schema";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function dimensionScoreLine(
  dims: AnalysisResult["dimensions"],
): string {
  return DIMENSIONS.map((dim) => {
    const r = dims[dim.id as keyof AnalysisResult["dimensions"]];
    return r ? `${dim.name.slice(0, 4)} ${r.score}` : null;
  })
    .filter(Boolean)
    .join(" · ");
}

const COLORS = {
  paper: "#f7f4ee",
  card: "#ffffff",
  ink: "#0f1b2d",
  ink2: "#3b4658",
  muted: "#7c8597",
  faint: "#a9b0bd",
  line: "#e3ddd0",
  lineStrong: "#cdc4b2",
  accent: "#2c5a6e",
  accentTint: "#dfe6ea",
  accentDeep: "#224556",
} as const;

function scoreDots(score: number): string {
  let html = "";
  for (let i = 1; i <= 5; i += 1) {
    const filled = i <= score;
    html += `<span style="display:inline-block;width:10px;height:10px;background:${filled ? COLORS.accent : COLORS.lineStrong};border-radius:2px;margin-right:3px;vertical-align:middle;"></span>`;
  }
  return html;
}

function averageDots(score: number): string {
  // For decimals: fill whole dots, then a fractional dot for the remainder.
  const whole = Math.floor(score);
  const remainder = score - whole;
  let html = "";
  for (let i = 1; i <= 5; i += 1) {
    if (i <= whole) {
      html += `<span style="display:inline-block;width:10px;height:10px;background:${COLORS.accent};border-radius:2px;margin-right:3px;vertical-align:middle;"></span>`;
    } else if (i === whole + 1 && remainder > 0) {
      const pct = Math.round(remainder * 100);
      html += `<span style="display:inline-block;width:10px;height:10px;background:linear-gradient(to right, ${COLORS.accent} ${pct}%, ${COLORS.lineStrong} ${pct}%);border-radius:2px;margin-right:3px;vertical-align:middle;"></span>`;
    } else {
      html += `<span style="display:inline-block;width:10px;height:10px;background:${COLORS.lineStrong};border-radius:2px;margin-right:3px;vertical-align:middle;"></span>`;
    }
  }
  return html;
}

export function buildDigestEmail(args: {
  stats: DigestStats;
  sessions: FullSession[];
  synthesis: Synthesis | null;
  windowLabel: string;
  appBaseUrl: string;
  todayLabel: string;
}): { subject: string; html: string; text: string } {
  const { stats, sessions, synthesis, windowLabel, appBaseUrl, todayLabel } =
    args;

  const subject = `Cadence — focus on ${stats.focus.dim.name} today`;

  const totalMinutes = Math.max(1, Math.round(stats.totalDurationMs / 60000));
  const headerLine = `${escapeHtml(todayLabel)} · ${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"} ${escapeHtml(windowLabel)} · ${totalMinutes} min`;

  const actionStepHtml = synthesis?.actionStep
    ? `<div style="margin-top:24px;border-left:3px solid ${COLORS.accent};padding:14px 16px;background:${COLORS.accentTint};border-radius:4px;">
  <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.accentDeep};margin-bottom:6px;">Try this today</div>
  <div style="font-size:15px;line-height:1.6;color:${COLORS.ink};">${escapeHtml(synthesis.actionStep)}</div>
</div>`
    : "";

  const focusExampleHtml = stats.focusExample
    ? `<div style="margin-top:12px;padding:10px 12px;background:${COLORS.paper};border-radius:6px;border:1px solid ${COLORS.line};">
  <div style="font-size:13px;font-style:italic;color:${COLORS.ink};line-height:1.5;">&ldquo;${escapeHtml(stats.focusExample.quote)}&rdquo;</div>
  <div style="font-size:12px;color:${COLORS.ink2};margin-top:4px;">${escapeHtml(stats.focusExample.issue)}</div>
</div>`
    : "";

  const scoresRows = stats.averages
    .map((avg) => {
      const isFocus = avg.dim.id === stats.focus.dim.id;
      const isBest = avg.dim.id === stats.best.dim.id;
      const labelTag = isFocus
        ? `<span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.accent};margin-left:8px;">Focus</span>`
        : isBest && avg.average >= 3.5
          ? `<span style="display:inline-block;font-size:9px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${COLORS.muted};margin-left:8px;">Strongest</span>`
          : "";
      return `<tr>
  <td style="font-size:13px;color:${COLORS.ink2};padding:5px 14px 5px 0;white-space:nowrap;">${escapeHtml(avg.dim.name)}${labelTag}</td>
  <td style="padding:5px 14px 5px 0;">${averageDots(avg.average)}</td>
  <td style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:${COLORS.ink2};padding:5px 0;">${avg.average.toFixed(1)} avg</td>
</tr>`;
    })
    .join("");

  const synthesisHtml = synthesis?.synthesis
    ? `<div style="margin-top:28px;">
  <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};margin-bottom:8px;">What stood out</div>
  <p style="margin:0;font-size:15px;line-height:1.7;color:${COLORS.ink2};">${escapeHtml(synthesis.synthesis)}</p>
</div>`
    : "";

  const sessionRows = sessions
    .map((s) => {
      const dims = s.analysis?.dimensions;
      const scoreLine = dims ? dimensionScoreLine(dims) : "—";
      const time = formatTimeShort(s.session.created_at);
      const dur = formatDuration(s.session.duration_ms ?? 0);
      return `<tr>
  <td style="padding:10px 0;border-top:1px solid ${COLORS.line};">
    <a href="${appBaseUrl}/sessions/${s.session.id}" style="color:${COLORS.ink};text-decoration:none;display:block;">
      <div style="font-size:14px;color:${COLORS.ink};"><strong>${escapeHtml(time)}</strong>&nbsp;<span style="color:${COLORS.muted};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;">${escapeHtml(dur)}</span></div>
      <div style="font-size:11px;color:${COLORS.muted};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:2px;">${escapeHtml(scoreLine)}</div>
    </a>
  </td>
</tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${COLORS.paper};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.ink};">
<div style="max-width:580px;margin:0 auto;padding:36px 28px;">

  <div style="font-size:10px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:${COLORS.muted};">Cadence</div>
  <div style="font-size:12px;color:${COLORS.faint};margin-top:4px;">${headerLine}</div>

  <div style="margin-top:28px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};margin-bottom:6px;">Focus today</div>
    <div style="display:flex;align-items:baseline;justify-content:space-between;">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;color:${COLORS.ink};letter-spacing:-0.01em;">${escapeHtml(stats.focus.dim.name)}</h1>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:18px;color:${COLORS.ink2};">${stats.focus.average.toFixed(1)} / 5</div>
    </div>
  </div>

  ${focusExampleHtml}

  ${actionStepHtml}

  <div style="margin-top:32px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};margin-bottom:10px;">${escapeHtml(windowLabel.charAt(0).toUpperCase() + windowLabel.slice(1))}'s scores</div>
    <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${scoresRows}
    </table>
  </div>

  ${synthesisHtml}

  <div style="margin-top:32px;">
    <div style="font-size:10px;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLORS.muted};">Sessions</div>
    <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:4px;">
      ${sessionRows}
    </table>
  </div>

  <div style="margin-top:36px;padding-top:18px;border-top:1px solid ${COLORS.line};font-size:12px;color:${COLORS.faint};text-align:center;">
    <a href="${appBaseUrl}" style="color:${COLORS.muted};text-decoration:none;">Open Cadence →</a>
  </div>

</div></body></html>`;

  // Plain text version
  const textLines: string[] = [];
  textLines.push(`Cadence — ${todayLabel}`);
  textLines.push(
    `${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"} ${windowLabel} · ${totalMinutes} min`,
  );
  textLines.push("");
  textLines.push(
    `FOCUS TODAY: ${stats.focus.dim.name} — ${stats.focus.average.toFixed(1)} / 5`,
  );
  if (stats.focusExample) {
    textLines.push(`  "${stats.focusExample.quote}"`);
    textLines.push(`  ${stats.focusExample.issue}`);
  }
  textLines.push("");
  if (synthesis?.actionStep) {
    textLines.push(`TRY THIS TODAY`);
    textLines.push(synthesis.actionStep);
    textLines.push("");
  }
  textLines.push("YESTERDAY'S SCORES");
  for (const avg of stats.averages) {
    textLines.push(`  ${avg.dim.name}: ${avg.average.toFixed(1)} avg`);
  }
  textLines.push("");
  if (synthesis?.synthesis) {
    textLines.push("WHAT STOOD OUT");
    textLines.push(synthesis.synthesis);
    textLines.push("");
  }
  textLines.push("SESSIONS");
  for (const s of sessions) {
    const dims = s.analysis?.dimensions;
    const scoreLine = dims ? dimensionScoreLine(dims) : "—";
    const time = formatTimeShort(s.session.created_at);
    const dur = formatDuration(s.session.duration_ms ?? 0);
    textLines.push(`  · ${time} (${dur}) — ${scoreLine}`);
    textLines.push(`    ${appBaseUrl}/sessions/${s.session.id}`);
  }
  textLines.push("");
  textLines.push(`Open Cadence: ${appBaseUrl}`);

  return { subject, html, text: textLines.join("\n") };
}
