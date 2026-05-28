import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          fontSize: 112,
          fontWeight: 600,
          fontFamily: "system-ui",
          letterSpacing: "-0.03em",
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
