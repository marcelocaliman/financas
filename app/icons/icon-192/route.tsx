import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(<IconMark />, { width: 192, height: 192 });
}

function IconMark() {
  return (
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
        fontSize: 130,
        fontWeight: 600,
        letterSpacing: "-0.04em",
        position: "relative",
      }}
    >
      ƒ
      <div
        style={{
          position: "absolute",
          right: 32,
          bottom: 42,
          width: 20,
          height: 20,
          borderRadius: 999,
          background: "#b07b32",
        }}
      />
    </div>
  );
}
