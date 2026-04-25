import { useState } from 'react';
import { useMatchmaker } from './hooks/useMatchmaker';
import { VideoGrid } from './components/VideoGrid';
import { RefreshCw, Send, LogIn } from 'lucide-react';

function UsernameGate({ onJoin }: { onJoin: (name: string) => void }) {
    const [input, setInput] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const name = input.trim();
        if (name) onJoin(name);
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
                <h1 className="text-2xl font-bold tracking-widest text-blue-400">
                    RANDOM<span className="text-white">CHAT</span>
                </h1>
                <p className="text-gray-400 text-sm text-center">Choose a display name to join</p>
                <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
                    <input
                        autoFocus
                        type="text"
                        maxLength={20}
                        placeholder="Your name..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="w-full bg-gray-800 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-3 rounded-lg font-bold transition-all disabled:opacity-40"
                    >
                        <LogIn size={18} /> Join
                    </button>
                </form>
            </div>
        </div>
    );
}

function ChatApp({ username, onLeave }: { username: string; onLeave: () => void }) {
    const { matchData, swipe, connectionStatus, isConnected, isTaken, chatMessages, sendMessage } = useMatchmaker(username);
    const [chatInput, setChatInput] = useState('');

    // Username was taken — kick back to gate
    if (isTaken) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <div className="bg-gray-900 border border-red-800 rounded-2xl p-10 flex flex-col items-center gap-6 w-full max-w-sm">
                    <h2 className="text-xl font-bold text-red-400">Username taken</h2>
                    <p className="text-gray-400 text-sm text-center">
                        <span className="text-white font-semibold">"{username}"</span> is already in use. Pick another name.
                    </p>
                    <button
                        onClick={onLeave}
                        className="bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold transition-all"
                    >
                        Go back
                    </button>
                </div>
            </div>
        );
    }

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            sendMessage(chatInput);
            setChatInput('');
        }
    };

    return (
        <div className="min-h-screen bg-black flex flex-col text-white">
            <div className="w-full h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900 z-50">
                <h1 className="text-xl font-bold tracking-widest text-blue-400">
                    RANDOM<span className="text-white">CHAT</span>
                </h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400 hidden sm:block">{connectionStatus}</span>
                    <span className="text-sm text-blue-300 font-semibold">{username}</span>
                    <button
                        onClick={swipe}
                        disabled={!isConnected}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={18} className={!matchData && isConnected ? 'animate-spin' : ''} />
                        SWIPE
                    </button>
                    <button
                        onClick={onLeave}
                        className="text-sm text-gray-500 hover:text-red-400 transition-all"
                    >
                        Leave
                    </button>
                </div>
            </div>

            <div className="flex-1 w-full flex p-4 gap-4 max-w-screen-2xl mx-auto overflow-hidden">
                <div className="flex-[3] relative">
                    <VideoGrid matchData={matchData} isConnected={isConnected} />
                </div>

                {matchData && (
                    <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-gray-800 font-bold">Room Chat</div>
                        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                            {chatMessages.map((msg, idx) => (
                                <div key={idx} className={`max-w-[80%] rounded-lg p-3 ${msg.sender === username ? 'bg-blue-600 self-end' : 'bg-gray-800 self-start'}`}>
                                    <div className="text-xs text-gray-300 mb-1">{msg.sender}</div>
                                    <div className="text-sm">{msg.text}</div>
                                </div>
                            ))}
                        </div>
                        <form onSubmit={handleSend} className="p-3 border-t border-gray-800 flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-1 bg-gray-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button type="submit" className="bg-blue-600 p-2 rounded-lg hover:bg-blue-500">
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                )}
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
