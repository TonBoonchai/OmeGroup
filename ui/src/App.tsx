import { useState } from "react";
import { useMatchmaker } from "./hooks/useMatchmaker";
import { VideoGrid } from "./components/VideoGrid";
import { Send, LogOut } from "lucide-react";

const ORANGE = "#E05E36";
const GREEN = "#42A77E";

function OmeLogo({ size = "lg" }: { size?: "lg" | "sm" }) {
  const fontSize = size === "lg" ? 96 : 32;
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

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = input.trim();
    if (name) onJoin(name);
  };

  return (
    /* Full-screen orange frame */
    <div
      style={{
        height: "100vh",
        backgroundColor: "#1a1a1a",
        padding: 16,
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      <div
        style={{
          flex: 1,
          backgroundColor: ORANGE,
          borderRadius: 20,
          padding: 10,
          display: "flex",
        }}
      >
        {/* White inner, centered content */}
        <div
          style={{
            flex: 1,
            backgroundColor: "white",
            borderRadius: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circles top-right */}
          <Circle
            size={80}
            style={{ position: "absolute", top: 32, right: 40 }}
          />
          <Circle
            size={56}
            style={{ position: "absolute", top: 120, right: 64 }}
          />

          {/* Form card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 32,
              width: 480,
            }}
          >
            <OmeLogo size="lg" />
            <p
              style={{
                color: "#6b7280",
                fontSize: 22,
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
                  padding: "12px 16px",
                  fontSize: 25,
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
                  padding: "12px 0",
                  fontSize: 15,
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
    /* Full-screen dark bg */
    <div
      style={{
        height: "100vh",
        backgroundColor: "#1a1a1a",
        padding: 16,
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      {/* Orange frame fills the space */}
      <div
        style={{
          flex: 1,
          backgroundColor: ORANGE,
          borderRadius: 20,
          padding: 10,
          display: "flex",
        }}
      >
        {/* White inner */}
        <div
          style={{
            flex: 1,
            backgroundColor: "white",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Main row: video + chat */}
          <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
            {/* Video area */}
            <div style={{ flex: 1, padding: 12, overflow: "hidden" }}>
              <VideoGrid matchData={matchData} isConnected={isConnected} />
            </div>

            {/* Chat sidebar */}
            <div
              style={{
                width: 260,
                borderLeft: `2px solid ${ORANGE}`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 16px",
                  fontWeight: 700,
                  color: ORANGE,
                  borderBottom: `2px solid ${ORANGE}`,
                  fontSize: 15,
                }}
              >
                Room Chat
              </div>

              {/* Messages */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    style={{
                      maxWidth: "90%",
                      alignSelf:
                        msg.sender === username ? "flex-end" : "flex-start",
                      backgroundColor:
                        msg.sender === username ? ORANGE : "#e5e7eb",
                      color: msg.sender === username ? "white" : "#1f2937",
                      borderRadius: 12,
                      padding: "8px 12px",
                      fontSize: 13,
                    }}
                  >
                    <div
                      style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}
                    >
                      {msg.sender}
                    </div>
                    {msg.text}
                  </div>
                ))}
              </div>

              {/* Input */}
              <form
                onSubmit={handleSend}
                style={{
                  padding: 10,
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
                    padding: "8px 12px",
                    fontSize: 13,
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
              padding: "12px 20px",
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
                padding: "12px 48px",
                fontWeight: 700,
                fontSize: 18,
                cursor: "pointer",
                opacity: isConnected ? 1 : 0.4,
              }}
            >
              Next
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontWeight: 600, color: "#374151", fontSize: 14 }}>
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
                  padding: "10px 14px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <LogOut size={18} />
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

  if (!username) {
    return <UsernameGate onJoin={setUsername} />;
  }

  return <ChatApp username={username} onLeave={() => setUsername(null)} />;
}

export default App;
