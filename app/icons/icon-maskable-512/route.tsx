import { ImageResponse } from "next/og";

export const runtime = "edge";

// Maskable: ícone com safe-zone (80% central), o resto pode ser cortado.
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
          fontSize: 250,
          fontWeight: 600,
          letterSpacing: "-0.04em",
          position: "relative",
        }}
      >
        ƒ
        <div
          style={{
            position: "absolute",
            right: 130,
            bottom: 155,
            width: 40,
            height: 40,
            borderRadius: 999,
            background: "#b07b32",
          }}
        />
      </div>
    ),
    { width: 512, height: 512 },
  );
}
