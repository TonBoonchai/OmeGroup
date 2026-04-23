import { useState } from 'react';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useMatchmaker } from './hooks/useMatchmaker';
import { VideoGrid } from './components/VideoGrid';
import { RefreshCw, LogOut, Send } from 'lucide-react';

Amplify.configure({ Auth: { Cognito: { userPoolId: '...', userPoolClientId: '...' } } });

function App() {
    const { matchData, swipe, connectionStatus, isConnected, chatMessages, sendMessage } = useMatchmaker();
    const [chatInput, setChatInput] = useState("");

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatInput.trim()) {
            sendMessage(chatInput);
            setChatInput("");
        }
    };

    return (
        <Authenticator variation="modal" loginMechanisms={['email']}>
            {({ signOut, user }) => (
                <div className="min-h-screen bg-black flex flex-col text-white">
                    {/* Header */}
                    <div className="w-full h-16 border-b border-gray-800 flex items-center justify-between px-6 bg-gray-900 z-50">
                        <h1 className="text-xl font-bold tracking-widest text-blue-400">RANDOM<span className="text-white">CHAT</span></h1>
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-400">{connectionStatus}</span>
                            <button onClick={swipe} disabled={!isConnected} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-full font-bold">
                                <RefreshCw size={18} className={!matchData && isConnected ? "animate-spin" : ""} /> SWIPE
                            </button>
                            <button onClick={signOut} className="p-2 bg-red-600/20 text-red-500 rounded-full"><LogOut size={18} /></button>
                        </div>
                    </div>

                    <div className="flex-1 w-full flex p-4 gap-4 max-w-screen-2xl mx-auto">
                        {/* 70% Video Grid */}
                        <div className="flex-[3] relative">
                            <VideoGrid matchData={matchData} isConnected={isConnected} />
                        </div>

                        {/* 30% Chat Box (Only shown when matched) */}
                        {matchData && (
                            <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 flex flex-col overflow-hidden">
                                <div className="p-4 border-b border-gray-800 font-bold">Room Chat</div>
                                
                                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className={`max-w-[80%] rounded-lg p-3 ${msg.sender === 'Me' ? 'bg-blue-600 self-end' : 'bg-gray-800 self-start'}`}>
                                            <div className="text-xs text-gray-300 mb-1">{msg.sender}</div>
                                            <div className="text-sm">{msg.text}</div>
                                        </div>
                                    ))}
                                </div>

                                <form onSubmit={handleSend} className="p-3 border-t border-gray-800 flex gap-2">
                                    <input 
                                        type="text" 
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-gray-800 rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button type="submit" className="bg-blue-600 p-2 rounded-lg"><Send size={20} /></button>
                                </form>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Authenticator>
    );
}
export default App;