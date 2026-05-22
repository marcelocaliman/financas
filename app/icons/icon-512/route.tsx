import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
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
          fontSize: 340,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          position: "relative",
        }}
      >
        ƒ
        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: 110,
            width: 52,
            height: 52,
            borderRadius: 999,
            background: "#b07b32",
          }}
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
