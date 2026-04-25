import { useState, useEffect, useRef } from "react";
import { useMatchmaker } from "./hooks/useMatchmaker";
import { VideoGrid } from "./components/VideoGrid";
import { Send, LogOut } from "lucide-react";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

function useIsPortrait() {
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  useEffect(() => {
    const handler = () => setIsPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isPortrait;
}

function RotateOverlay() {
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

const ORANGE = "#E05E36";
const GREEN = "#42A77E";

function OmeLogo({ size = "lg" }: { size?: "lg" | "sm" | "mobile" }) {
  const fontSize = size === "lg" ? 96 : size === "mobile" ? 48 : 32;
  return (
    <span
      style={{ fontSize, fontWeight: 800, letterSpacing: -1, lineHeight: 1 }}
    >
      <span style={{ color: ORANGE }}>Ome</span>
      <span style={{ color: GREEN }}>Group</span>
    </span>
  );
}

function Circle({
  size,
  style,
}: {
  size: number;
  style?: React.CSSProperties;
}) {
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

function UsernameGate({ onJoin }: { onJoin: (name: string) => void }) {
  const [input, setInput] = useState("");
  const isMobile = useIsMobile();

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = input.trim();
    if (name) onJoin(name);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1a1a1a",
        padding: isMobile ? 8 : 16,
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      <div
        style={{
          flex: 1,
          backgroundColor: ORANGE,
          borderRadius: isMobile ? 12 : 20,
          padding: isMobile ? 6 : 10,
          display: "flex",
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundColor: "white",
            borderRadius: isMobile ? 8 : 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
            padding: "0 16px",
          }}
        >
          {!isMobile && (
            <>
              <Circle size={80} style={{ position: "absolute", top: 32, right: 40 }} />
              <Circle size={56} style={{ position: "absolute", top: 120, right: 64 }} />
            </>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: isMobile ? 20 : 32,
              width: "100%",
              maxWidth: 480,
            }}
          >
            <OmeLogo size={isMobile ? "mobile" : "lg"} />
            <p
              style={{
                color: "#6b7280",
                fontSize: isMobile ? 16 : 22,
                margin: 0,
                fontWeight: 600,
              }}
            >
              Choose a display name
            </p>
            <form
              onSubmit={handleSubmit}
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <input
                autoFocus
                type="text"
                maxLength={20}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{
                  width: "100%",
                  border: `2px solid ${ORANGE}`,
                  borderRadius: 8,
                  padding: isMobile ? "10px 14px" : "12px 16px",
                  fontSize: isMobile ? 18 : 25,
                  outline: "none",
                  color: "#1f2937",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="submit"
                disabled={!input.trim()}
                style={{
                  width: "100%",
                  backgroundColor: ORANGE,
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  padding: "14px 0",
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: input.trim() ? 1 : 0.4,
                }}
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatApp({
  username,
  onLeave,
}: {
  username: string;
  onLeave: () => void;
}) {
  const { matchData, swipe, isConnected, isTaken, chatMessages, sendMessage } =
    useMatchmaker(username);
  const [chatInput, setChatInput] = useState("");
  const isMobile = useIsMobile();
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  if (isTaken) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            backgroundColor: ORANGE,
            borderRadius: 24,
            padding: 12,
            width: 460,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: "56px 48px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 24,
            }}
          >
            <OmeLogo size="lg" />
            <p style={{ color: "#374151", textAlign: "center", margin: 0 }}>
              <strong>"{username}"</strong> is already in use.
              <br />
              Pick another name.
            </p>
            <button
              onClick={onLeave}
              style={{
                backgroundColor: ORANGE,
                color: "white",
                border: "none",
                borderRadius: 8,
                padding: "12px 32px",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                width: "100%",
              }}
            >
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
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1a1a1a",
        padding: isMobile ? 8 : 16,
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      <div
        style={{
          flex: 1,
          backgroundColor: ORANGE,
          borderRadius: isMobile ? 12 : 20,
          padding: isMobile ? 6 : 10,
          display: "flex",
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundColor: "white",
            borderRadius: isMobile ? 8 : 12,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Main area: video + chat — row on desktop, column on mobile */}
          <div style={{ flex: 1, display: "flex", flexDirection: isMobile ? "column" : "row", overflow: "hidden" }}>

            {/* Video area */}
            <div style={{ flex: 1, padding: isMobile ? 8 : 12, overflow: "hidden", minHeight: 0 }}>
              <VideoGrid matchData={matchData} isConnected={isConnected} />
            </div>

            {/* Chat — sidebar on desktop, compact strip on mobile */}
            <div
              style={{
                width: isMobile ? "100%" : 260,
                height: isMobile ? 200 : "auto",
                borderLeft: isMobile ? "none" : `2px solid ${ORANGE}`,
                borderTop: isMobile ? `2px solid ${ORANGE}` : "none",
                display: "flex",
                flexDirection: "column",
                flexShrink: 0,
                minHeight: 0,
              }}
            >
              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  padding: isMobile ? "6px 10px" : 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  minHeight: 0,
                }}
              >
                {chatMessages.length === 0 && (
                  <div style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 8 }}>
                    No messages yet
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      maxWidth: "85%",
                      alignSelf: msg.sender === username ? "flex-end" : "flex-start",
                      backgroundColor: msg.sender === username ? ORANGE : "#e5e7eb",
                      color: msg.sender === username ? "white" : "#1f2937",
                      borderRadius: 12,
                      padding: "6px 10px",
                      fontSize: isMobile ? 12 : 13,
                    }}
                  >
                    <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>{msg.sender}</div>
                    {msg.text}
                  </div>
                ))}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat input */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: isMobile ? "6px 8px" : 10,
                  borderTop: `2px solid ${ORANGE}`,
                  display: "flex",
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Write a message"
                  style={{
                    flex: 1,
                    backgroundColor: "#f3f4f6",
                    borderRadius: 8,
                    padding: isMobile ? "8px 10px" : "8px 12px",
                    fontSize: isMobile ? 14 : 13,
                    border: "none",
                    outline: "none",
                    color: "#1f2937",
                  }}
                />
                <button
                  type="submit"
                  style={{
                    backgroundColor: ORANGE,
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            style={{
              borderTop: `2px solid ${ORANGE}`,
              padding: isMobile ? "8px 12px" : "12px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <button
              onClick={swipe}
              disabled={!isConnected}
              style={{
                backgroundColor: GREEN,
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: isMobile ? "10px 32px" : "12px 48px",
                fontWeight: 700,
                fontSize: isMobile ? 16 : 18,
                cursor: "pointer",
                opacity: isConnected ? 1 : 0.4,
              }}
            >
              Next
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, color: "#374151", fontSize: isMobile ? 12 : 14 }}>
                {username}
              </span>
              <button
                onClick={onLeave}
                title="Leave"
                style={{
                  backgroundColor: ORANGE,
                  color: "white",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [username, setUsername] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const isPortrait = useIsPortrait();

  if (isMobile && isPortrait) return <RotateOverlay />;

  return !username
    ? <UsernameGate onJoin={setUsername} />
    : <ChatApp username={username} onLeave={() => setUsername(null)} />;
}

export default App;
