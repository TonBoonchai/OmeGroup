import { useState, useCallback, useEffect, useRef } from 'react';
import _wsModule, { ReadyState } from 'react-use-websocket';
const useWebSocket: typeof _wsModule = (_wsModule as any).default ?? _wsModule;

const WS_BASE_URL = import.meta.env.VITE_WEBSOCKET_URL;

export interface MatchPayload {
    stageArn: string;
    participantToken: string;
}

export interface ChatMessage {
    sender: string;
    text: string;
}

export function useMatchmaker(username: string) {
    const [matchData, setMatchData] = useState<MatchPayload | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [isTaken, setIsTaken] = useState(false);
    const everConnected = useRef(false);

    const wsUrl = `${WS_BASE_URL}?username=${encodeURIComponent(username)}`;

    const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(wsUrl, {
        shouldReconnect: () => false,
        onOpen: () => {
            everConnected.current = true;
            console.log('Connected as', username);
        },
        onClose: () => {
            // If we closed before onOpen ever fired, $connect was rejected = username taken
            if (!everConnected.current) setIsTaken(true);
        },
    });

    useEffect(() => {
        if (lastJsonMessage !== null) {
            const data = lastJsonMessage as any;

            if (data.type === 'match' || (data.participantToken && data.stageArn)) {
                setMatchData({ stageArn: data.stageArn, participantToken: data.participantToken });
                setChatMessages([]);
            } else if (data.type === 'chat') {
                // Skip echo of our own messages — we add them locally on send
                const sender = data.sender || 'Peer';
                if (sender !== username) {
                    setChatMessages(prev => [...prev, { sender, text: data.text }]);
                }
            }
        }
    }, [lastJsonMessage]);

    const swipe = useCallback(() => {
        setMatchData(null);
        setChatMessages([]);
        sendJsonMessage({ action: 'swipe' });
    }, [sendJsonMessage]);

    const sendMessage = useCallback((text: string) => {
        sendJsonMessage({ action: 'send_message', text });
        setChatMessages(prev => [...prev, { sender: username, text }]);
    }, [sendJsonMessage, username]);

    const connectionStatus = {
        [ReadyState.CONNECTING]: 'Connecting...',
        [ReadyState.OPEN]: 'Searching for a room...',
        [ReadyState.CLOSING]: 'Closing...',
        [ReadyState.CLOSED]: 'Disconnected',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    }[readyState] ?? 'Unknown';

    return {
        matchData,
        chatMessages,
        swipe,
        sendMessage,
        connectionStatus,
        isConnected: readyState === ReadyState.OPEN,
        isTaken,
    };
}
