import { ImageResponse } from "next/og";

export const alt =
  "Cadence — a speaking coach that scores how you communicate.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#f7f4ee",
          color: "#0f1b2d",
          padding: "84px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            letterSpacing: "5px",
            textTransform: "uppercase",
            color: "#2c5a6e",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontWeight: 600,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              background: "#2c5a6e",
              borderRadius: 999,
              display: "flex",
            }}
          />
          A speaking coach
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: 220,
              lineHeight: 0.95,
              fontWeight: 400,
              letterSpacing: "-7px",
              color: "#0f1b2d",
              display: "flex",
            }}
          >
            cadence
          </div>
          <div
            style={{
              fontSize: 52,
              lineHeight: 1.15,
              fontWeight: 400,
              fontStyle: "italic",
              color: "#3b4658",
              display: "flex",
            }}
          >
            Speak. Listen. Adjust.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#7c8597",
            fontSize: 22,
          }}
        >
          <div
            style={{
              display: "flex",
              fontStyle: "italic",
              maxWidth: 700,
              lineHeight: 1.4,
            }}
          >
            A daily read on how you actually speak — clarity, conciseness,
            confidence, word precision.
          </div>
          <div
            style={{
              display: "flex",
              fontFamily:
                "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace",
              fontSize: 18,
              color: "#a9b0bd",
              letterSpacing: "0.04em",
            }}
          >
            cadence.paahulhq.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
