import { OmeLogo } from "./shared/Logo";

export function RotateOverlay() {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      backgroundColor: "#1a1a1a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 24,
    }}>
      <div style={{ fontSize: 64 }}>🔄</div>
      <OmeLogo size="mobile" />
      <p style={{
        color: "white", fontSize: 18, fontWeight: 600,
        textAlign: "center", margin: 0, padding: "0 32px",
      }}>
        Please rotate your device to landscape mode
      </p>
    </div>
  );
}