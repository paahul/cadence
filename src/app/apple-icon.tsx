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
          background: "#2c5a6e",
          color: "#f7f4ee",
          fontSize: 130,
          fontWeight: 500,
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          paddingBottom: 8,
        }}
      >
        c
      </div>
    ),
    { ...size },
  );
}
