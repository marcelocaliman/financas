import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.04em",
        }}
      >
        ƒ
        <div
          style={{
            position: "absolute",
            right: 5,
            bottom: 6,
            width: 4,
            height: 4,
            borderRadius: 999,
            background: "#b07b32",
          }}
        />
      </div>
    ),
    size,
  );
}
