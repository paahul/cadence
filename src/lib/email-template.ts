import type { FullSession } from "./db";
import type { DigestStats } from "./digest";
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
  const date = new Date(iso);
  return date.toLocaleString("en-US", {
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

export function buildDigestEmail(args: {
  stats: DigestStats;
  sessions: FullSession[];
  synthesis: string | null;
  windowLabel: string;
  appBaseUrl: string;
  todayLabel: string;
}): { subject: string; html: string; text: string } {
  const { stats, sessions, synthesis, windowLabel, appBaseUrl, todayLabel } =
    args;

  const subject = `Cadence — your read for ${todayLabel}`;

  const synthesisBlock = synthesis
    ? `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#111827;">${escapeHtml(synthesis)}</p>`
    : `<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#111827;">You recorded ${stats.sessionCount} session${stats.sessionCount === 1 ? "" : "s"} ${escapeHtml(windowLabel)}. Strongest: <strong>${escapeHtml(stats.best.dim.name)}</strong>. Focus today: <strong>${escapeHtml(stats.focus.dim.name)}</strong>.</p>`;

  const sessionRows = sessions
    .map((s) => {
      const dims = s.analysis?.dimensions;
      const scoreLine = dims ? dimensionScoreLine(dims) : "—";
      const time = formatTimeShort(s.session.created_at);
      const dur = formatDuration(s.session.duration_ms ?? 0);
      return `<tr>
  <td style="padding:8px 0;border-top:1px solid #e5e7eb;">
    <a href="${appBaseUrl}/sessions/${s.session.id}" style="color:#0f172a;text-decoration:none;">
      <div style="font-size:14px;color:#111827;"><strong>${escapeHtml(time)}</strong> &nbsp;<span style="color:#6b7280;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;">${escapeHtml(dur)}</span></div>
      <div style="font-size:12px;color:#6b7280;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:2px;">${escapeHtml(scoreLine)}</div>
    </a>
  </td>
</tr>`;
    })
    .join("");

  const focusExampleBlock = stats.focusExample
    ? `<div style="margin-top:8px;padding:10px 12px;background:#fff;border-radius:6px;border:1px solid #e5e7eb;">
  <div style="font-size:13px;font-style:italic;color:#1f2937;">&ldquo;${escapeHtml(stats.focusExample.quote)}&rdquo;</div>
  <div style="font-size:12px;color:#6b7280;margin-top:4px;">${escapeHtml(stats.focusExample.issue)}</div>
</div>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#f9fafb;">

  <div style="font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#6b7280;margin-bottom:4px;">Cadence</div>
  <div style="font-size:12px;color:#9ca3af;margin-bottom:32px;">Your read for ${escapeHtml(todayLabel)}</div>

  ${synthesisBlock}

  <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:24px;border-collapse:collapse;">
    <tr>
      <td style="vertical-align:top;width:50%;padding:14px 16px;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Best</div>
        <div style="margin-top:4px;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(stats.best.dim.name)}</div>
        <div style="margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#374151;">${stats.best.average.toFixed(1)} / 5 avg</div>
      </td>
      <td style="width:8px;"></td>
      <td style="vertical-align:top;width:50%;padding:14px 16px;background:#0f172a;color:#f8fafc;border-radius:8px;">
        <div style="font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#94a3b8;">Focus today</div>
        <div style="margin-top:4px;font-size:16px;font-weight:600;color:#f8fafc;">${escapeHtml(stats.focus.dim.name)}</div>
        <div style="margin-top:2px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:#cbd5e1;">${stats.focus.average.toFixed(1)} / 5 avg</div>
      </td>
    </tr>
  </table>

  ${focusExampleBlock}

  <div style="margin-top:32px;font-size:10px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#6b7280;">Sessions</div>
  <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
    ${sessionRows}
  </table>

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
    <a href="${appBaseUrl}" style="color:#9ca3af;text-decoration:none;">Open Cadence →</a>
  </div>

</div></body></html>`;

  const textLines: string[] = [];
  textLines.push(`Cadence — your read for ${todayLabel}`);
  textLines.push("");
  if (synthesis) {
    textLines.push(synthesis);
    textLines.push("");
  }
  textLines.push(
    `Best:  ${stats.best.dim.name} — ${stats.best.average.toFixed(1)}/5 avg`,
  );
  textLines.push(
    `Focus: ${stats.focus.dim.name} — ${stats.focus.average.toFixed(1)}/5 avg`,
  );
  if (stats.focusExample) {
    textLines.push(`  "${stats.focusExample.quote}"`);
    textLines.push(`  ${stats.focusExample.issue}`);
  }
  textLines.push("");
  textLines.push("Sessions:");
  for (const s of sessions) {
    const dims = s.analysis?.dimensions;
    const scoreLine = dims ? dimensionScoreLine(dims) : "—";
    const time = formatTimeShort(s.session.created_at);
    const dur = formatDuration(s.session.duration_ms ?? 0);
    textLines.push(`  • ${time} (${dur}) — ${scoreLine}`);
    textLines.push(`    ${appBaseUrl}/sessions/${s.session.id}`);
  }
  textLines.push("");
  textLines.push(`Open Cadence: ${appBaseUrl}`);

  return { subject, html, text: textLines.join("\n") };
}
