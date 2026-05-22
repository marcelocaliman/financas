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
          background: "#0a0d12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          color: "white",
          fontStyle: "italic",
          fontSize: 120,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        ƒ
        <div
          style={{
            position: "absolute",
            right: 28,
            bottom: 38,
            width: 18,
            height: 18,
            borderRadius: 999,
            background: "#b07b32",
          }}
        />
      </div>
    ),
    size,
  );
}
