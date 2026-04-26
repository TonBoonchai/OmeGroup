import React, { useState } from "react";
import { UsernameGate } from "./components/UsernameGate";
import { ChatApp } from "./ChatApp";
import { RotateOverlay } from "./components/RotateOverlay";
import { useIsMobile, useIsPortrait } from "./hooks/useLayoutModes";

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