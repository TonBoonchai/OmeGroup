import React, { useEffect, useRef, useState } from 'react';
import { Stage, LocalStageStream, StageEvents, SubscribeType } from 'amazon-ivs-web-broadcast';
import type { MatchPayload } from '../hooks/useMatchmaker';

// --- 1. The Raw DOM Video Binder (Unchanged) ---
const VideoPlayer = ({ streams, isLocal }: { streams: any[], isLocal: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && streams.length > 0) {
            const mediaStream = new MediaStream();
            streams.forEach(s => mediaStream.addTrack(s.mediaStreamTrack));
            videoRef.current.srcObject = mediaStream;
        }
    }, [streams]);

    return (
        <div className="relative w-full h-full bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-700">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal} 
                className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`} 
            />
            {isLocal && (
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm font-semibold z-10">
                    You
                </div>
            )}
        </div>
    );
};

// --- 2. The Main Stage Orchestrator ---
interface VideoGridProps {
    matchData: MatchPayload | null; // Now accepts null when searching
    isConnected: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ matchData, isConnected }) => {
    const [localStreams, setLocalStreams] = useState<LocalStageStream[]>([]);
    const [remoteParticipants, setRemoteParticipants] = useState<{ id: string; streams: any[] }[]>([]);
    const stageRef = useRef<Stage | null>(null);

    // Step 1: Request Hardware Access Immediately & Permanently
    useEffect(() => {
        let activeTracks: MediaStreamTrack[] = [];

        const initLocalMedia = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                activeTracks = mediaStream.getTracks();
                const ivsStreams = activeTracks.map(track => new LocalStageStream(track));
                setLocalStreams(ivsStreams);
            } catch (err) {
                console.error("Camera access denied or failed", err);
            }
        };

        initLocalMedia();
        return () => { activeTracks.forEach(t => t.stop()); };
    }, []);

    // Step 2: Hydrate AWS IVS ONLY when matchData is provided
    useEffect(() => {
        // If we swiped and matchData is null, do not execute the IVS join logic
        if (!matchData || !matchData.participantToken || localStreams.length === 0) return;

        const strategy = {
            stageStreamsToPublish: () => localStreams,
            shouldPublishParticipant: () => true,
            shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO,
        };

        const stage = new Stage(matchData.participantToken, strategy);
        stageRef.current = stage;

        stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, (participant: any, streams: any[]) => {
            if (participant.isLocal) return;
            setRemoteParticipants(prev => [...prev, { id: participant.id, streams }]);
        });

        stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant: any) => {
            setRemoteParticipants(prev => prev.filter(p => p.id !== participant.id));
        });

        stage.join().catch(err => console.error("IVS Join Error:", err));

        // CRITICAL CLEANUP: When matchData becomes null (user swiped), leave the stage immediately
        // but the localStreams state is completely untouched!
        return () => {
            stage.leave();
            setRemoteParticipants([]); 
        };
    }, [matchData, localStreams]);

    // Step 3: Dynamic Layout Calculation
    const totalPeople = 1 + remoteParticipants.length;
    let gridClass = "grid-cols-1"; 
    
    if (matchData && totalPeople === 2) gridClass = "grid-cols-1";
    else if (matchData && (totalPeople === 3 || totalPeople === 4)) gridClass = "grid-cols-2 sm:grid-rows-2";
    else if (matchData && totalPeople > 4) gridClass = "grid-cols-3 sm:grid-rows-2"; 

    return (
        <div className={`w-full h-full max-h-[85vh] grid gap-4 relative ${gridClass}`}>
            
            {/* If there is no match, render a glassmorphism "Waiting" overlay on top of the local camera */}
            {!matchData && localStreams.length > 0 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h2 className="text-2xl font-bold text-white drop-shadow-md">
                        {isConnected ? "Searching for a room..." : "Connecting to server..."}
                    </h2>
                </div>
            )}

            {/* Local Camera (Always rendered if available) */}
            {localStreams.length > 0 && (
                <VideoPlayer streams={localStreams} isLocal={true} />
            )}

            {/* Remote Cameras (Only rendered if matchData exists and people joined) */}
            {matchData && remoteParticipants.map(participant => (
                <VideoPlayer key={participant.id} streams={participant.streams} isLocal={false} />
            ))}
        </div>
    );
};