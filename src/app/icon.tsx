import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 360,
          fontWeight: 500,
          fontFamily: "Georgia, 'Times New Roman', serif",
          letterSpacing: "-0.04em",
          lineHeight: 1,
          paddingBottom: 24,
        }}
      >
        c
      </div>
    ),
    { ...size },
  );
}
