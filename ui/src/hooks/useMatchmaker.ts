import { useState, useCallback, useEffect } from 'react';
import _wsModule, { ReadyState } from 'react-use-websocket';
const useWebSocket: typeof _wsModule = (_wsModule as any).default ?? _wsModule;
import { fetchAuthSession } from 'aws-amplify/auth';

const WS_BASE_URL = import.meta.env.VITE_WEBSOCKET_URL;

export interface MatchPayload {
    stageArn: string;
    participantToken: string;
}

export interface ChatMessage {
    sender: string;
    text: string;
}

export function useMatchmaker() {
    const [matchData, setMatchData] = useState<MatchPayload | null>(null);
    const [wsUrl, setWsUrl] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    // 1. Fetch the JWT before connecting
    useEffect(() => {
        const getAuthToken = async () => {
            try {
                const session = await fetchAuthSession();
                const token = session.tokens?.accessToken?.toString();
                if (token) {
                    setWsUrl(`${WS_BASE_URL}?token=${token}`);
                }
            } catch (err) {
                console.error("No valid session found", err);
            }
        };
        getAuthToken();
    }, []);

    // 2. WebSocket connection
    const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(wsUrl, {
        shouldReconnect: () => true,
        reconnectAttempts: 10,
        reconnectInterval: 3000,
        onOpen: () => console.log('Connected to AWS Matchmaker Securely'),
    });

    // 3. Centralized Message Handler
    useEffect(() => {
        if (lastJsonMessage !== null) {
            const data = lastJsonMessage as any;

            // Handle Match found (Either direct or via 'type' property)
            if (data.type === 'match' || (data.participantToken && data.stageArn)) {
                console.log('Match found! Hydrating IVS Stage...');
                setMatchData({
                    stageArn: data.stageArn,
                    participantToken: data.participantToken
                });
                setChatMessages([]); // Reset chat for the new pair
            } 
            
            // Handle Incoming Chat
            else if (data.type === 'chat') {
                setChatMessages(prev => [...prev, { sender: data.sender || 'Peer', text: data.text }]);
            }
        }
    }, [lastJsonMessage]);

    // Actions
    const swipe = useCallback(() => {
        console.log('Swiping! Requesting new room...');
        setMatchData(null); 
        setChatMessages([]);
        sendJsonMessage({ action: 'swipe' });
    }, [sendJsonMessage]);

    const sendMessage = useCallback((text: string) => {
        sendJsonMessage({ action: 'send_message', text });
        // Optimistically add to local UI
        setChatMessages(prev => [...prev, { sender: 'Me', text }]); 
    }, [sendJsonMessage]);

    const connectionStatus = {
        [ReadyState.CONNECTING]: 'Connecting...',
        [ReadyState.OPEN]: 'Searching for a room...',
        [ReadyState.CLOSING]: 'Closing...',
        [ReadyState.CLOSED]: 'Disconnected',
        [ReadyState.UNINSTANTIATED]: 'Uninstantiated',
    }[readyState];

    return {
        matchData,
        chatMessages,
        swipe,
        sendMessage,
        connectionStatus,
        isConnected: readyState === ReadyState.OPEN
    };
}