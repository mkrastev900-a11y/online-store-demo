import { ImageResponse } from "next/og";

export function createStoreIconImage(size: number) {
  const unit = size / 64;

  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "#171717",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: "#10b981",
          borderRadius: 12 * unit,
          display: "flex",
          height: 46 * unit,
          justifyContent: "center",
          position: "relative",
          width: 46 * unit,
        }}
      >
        <div
          style={{
            border: `${4 * unit}px solid #ffffff`,
            borderRadius: 5 * unit,
            display: "flex",
            height: 25 * unit,
            marginTop: 7 * unit,
            width: 27 * unit,
          }}
        />
        <div
          style={{
            border: `${4 * unit}px solid #ffffff`,
            borderBottom: "none",
            borderRadius: `${9 * unit}px ${9 * unit}px 0 0`,
            display: "flex",
            height: 11 * unit,
            left: 17 * unit,
            position: "absolute",
            top: 7 * unit,
            width: 12 * unit,
          }}
        />
      </div>
    </div>,
    { height: size, width: size },
  );
}
