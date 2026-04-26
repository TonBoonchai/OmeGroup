import React, { useState, useEffect, useRef } from "react";
import { Send, LogOut } from "lucide-react";
import { useMatchmaker } from "./hooks/useMatchmaker";
import { VideoGrid } from "./components/VideoGrid";
import { useIsMobile } from "./hooks/useLayoutModes";
import { OmeLogo, ORANGE, GREEN } from "./components/shared/Logo";

export function ChatApp({ username, onLeave }: { username: string; onLeave: () => void }) {
  const { matchData, swipe, isConnected, isTaken, chatMessages, sendMessage } = useMatchmaker(username);
  const [chatInput, setChatInput] = useState("");
  const isMobile = useIsMobile();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (isTaken) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ backgroundColor: ORANGE, borderRadius: 24, padding: 12, width: 460 }}>
          <div style={{ backgroundColor: "white", borderRadius: 16, padding: "56px 48px", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
            <OmeLogo size="lg" />
            <p style={{ color: "#374151", textAlign: "center", margin: 0 }}>
              <strong>"{username}"</strong> is already in use.<br />Pick another name.
            </p>
            <button onClick={onLeave} style={{ backgroundColor: ORANGE, color: "white", border: "none", borderRadius: 8, padding: "12px 32px", fontWeight: 700, fontSize: 15, cursor: "pointer", width: "100%" }}>
              Go back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSend = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (chatInput.trim()) {
      sendMessage(chatInput);
      setChatInput("");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#1a1a1a", padding: isMobile ? 8 : 16, boxSizing: "border-box", display: "flex" }}>
      <div style={{ flex: 1, backgroundColor: ORANGE, borderRadius: isMobile ? 12 : 20, padding: isMobile ? 6 : 10, display: "flex" }}>
        <div style={{ flex: 1, backgroundColor: "white", borderRadius: isMobile ? 8 : 12, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          
          <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>
            <div style={{ flex: 1, padding: isMobile ? 8 : 12, overflow: "hidden", minHeight: 0 }}>
              <VideoGrid matchData={matchData} isConnected={isConnected} />
            </div>

            <div style={{ width: isMobile ? "100%" : 260, height: isMobile ? 200 : "auto", borderLeft: isMobile ? "none" : `2px solid ${ORANGE}`, borderTop: isMobile ? `2px solid ${ORANGE}` : "none", display: "flex", flexDirection: "column", flexShrink: 0, minHeight: 0 }}>
              <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: isMobile ? "6px 10px" : 12, display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
                {chatMessages.length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 8 }}>No messages yet</div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div key={idx} style={{ maxWidth: "85%", alignSelf: msg.sender === username ? "flex-end" : "flex-start", backgroundColor: msg.sender === username ? ORANGE : "#e5e7eb", color: msg.sender === username ? "white" : "#1f2937", borderRadius: 12, padding: "6px 10px", fontSize: isMobile ? 12 : 13 }}>
                    <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>{msg.sender}</div>
                    {msg.text}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={handleSend} style={{ padding: isMobile ? "6px 8px" : 10, borderTop: `2px solid ${ORANGE}`, display: "flex", gap: 8 }}>
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Write a message" style={{ flex: 1, backgroundColor: "#f3f4f6", borderRadius: 8, padding: isMobile ? "8px 10px" : "8px 12px", fontSize: isMobile ? 14 : 13, border: "none", outline: "none", color: "#1f2937" }} />
                <button type="submit" style={{ backgroundColor: ORANGE, color: "white", border: "none", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>

          <div style={{ borderTop: `2px solid ${ORANGE}`, padding: isMobile ? "8px 12px" : "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button onClick={swipe} disabled={!isConnected} style={{ backgroundColor: GREEN, color: "white", border: "none", borderRadius: 12, padding: isMobile ? "10px 32px" : "12px 48px", fontWeight: 700, fontSize: isMobile ? 16 : 18, cursor: "pointer", opacity: isConnected ? 1 : 0.4 }}>
              Next
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#374151", fontSize: isMobile ? 12 : 14 }}>{username}</span>
              <button onClick={onLeave} title="Leave" style={{ backgroundColor: ORANGE, color: "white", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", display: "flex", alignItems: "center" }}>
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}