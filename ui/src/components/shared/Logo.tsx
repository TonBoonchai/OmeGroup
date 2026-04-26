import React from "react";

export const ORANGE = "#E05E36";
export const GREEN = "#42A77E";

export function OmeLogo({ size = "lg" }: { size?: "lg" | "sm" | "mobile" }) {
  const fontSize = size === "lg" ? 96 : size === "mobile" ? 48 : 32;
  return (
    <span style={{ fontSize, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}>
      <span style={{ color: ORANGE }}>Ome</span>
      <span style={{ color: GREEN }}>Group</span>
    </span>
  );
}

export function Circle({ size, style }: { size: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: ORANGE,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}