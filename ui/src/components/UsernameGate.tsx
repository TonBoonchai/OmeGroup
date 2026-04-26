import React, { useState } from "react";
import { OmeLogo, Circle, ORANGE } from "./shared/Logo";
import { useIsMobile } from "../hooks/useLayoutModes";

export function UsernameGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [input, setInput] = useState("");
  const isMobile = useIsMobile();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = input.trim();
    if (name) onJoin(name);
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1a1a1a", padding: isMobile ? 8 : 16, boxSizing: "border-box", display: "flex" }}>
      <div style={{ flex: 1, backgroundColor: ORANGE, borderRadius: isMobile ? 12 : 20, padding: isMobile ? 6 : 10, display: "flex" }}>
        <div style={{ flex: 1, backgroundColor: "white", borderRadius: isMobile ? 8 : 12, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", padding: "0 16px" }}>
          {!isMobile && (
            <>
              <Circle size={80} style={{ position: "absolute", top: 32, right: 40 }} />
              <Circle size={56} style={{ position: "absolute", top: 120, right: 64 }} />
            </>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 20 : 32, width: "100%", maxWidth: 480 }}>
            <OmeLogo size={isMobile ? "mobile" : "lg"} />
            <p style={{ color: "#6b7280", fontSize: isMobile ? 16 : 22, margin: 0, fontWeight: 600 }}>
              Choose a display name
            </p>
            <form onSubmit={handleSubmit} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
              <input autoFocus type="text" maxLength={20} value={input} onChange={(e) => setInput(e.target.value)} style={{ width: "100%", border: `2px solid ${ORANGE}`, borderRadius: 8, padding: isMobile ? "10px 14px" : "12px 16px", fontSize: isMobile ? 18 : 25, outline: "none", color: "#1f2937", boxSizing: "border-box" }} />
              <button type="submit" disabled={!input.trim()} style={{ width: "100%", backgroundColor: ORANGE, color: "white", border: "none", borderRadius: 8, padding: "14px 0", fontSize: 16, fontWeight: 700, cursor: "pointer", opacity: input.trim() ? 1 : 0.4 }}>
                Join
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}