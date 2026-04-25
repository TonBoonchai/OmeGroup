import React, { useEffect, useRef, useState } from 'react';
import { Stage, LocalStageStream, StageEvents, SubscribeType } from 'amazon-ivs-web-broadcast';
import type { MatchPayload } from '../hooks/useMatchmaker';

const VideoPlayer = ({ streams, isLocal, portrait }: { streams: any[], isLocal: boolean, portrait?: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && streams.length > 0) {
            const mediaStream = new MediaStream();
            streams.forEach(s => mediaStream.addTrack(s.mediaStreamTrack));
            videoRef.current.srcObject = mediaStream;
        }
    }, [streams]);

    return (
        <div
            className="relative bg-gray-900 rounded-xl overflow-hidden shadow-lg border border-gray-700"
            style={portrait ? { flex: 1, height: '100%', minWidth: 0 } : { width: '100%', height: '100%' }}
        >
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

interface VideoGridProps {
    matchData: MatchPayload | null;
    isConnected: boolean;
}

export const VideoGrid: React.FC<VideoGridProps> = ({ matchData, isConnected }) => {
    const [localStreams, setLocalStreams] = useState<LocalStageStream[]>([]);
    // Map keyed by participant ID — structurally prevents duplicates
    const [remoteParticipants, setRemoteParticipants] = useState<Map<string, any[]>>(new Map());

    // Use refs so the IVS effect never needs to re-run due to stream/stage changes
    const stageRef = useRef<Stage | null>(null);
    const localStreamsRef = useRef<LocalStageStream[]>([]);
    const localTrackIdsRef = useRef<Set<string>>(new Set());

    // Step 1: Acquire camera/mic once — store in both state (for rendering) and ref (for IVS strategy)
    useEffect(() => {
        let activeTracks: MediaStreamTrack[] = [];

        const init = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                activeTracks = mediaStream.getTracks();
                const ivsStreams = activeTracks.map(t => new LocalStageStream(t));
                localStreamsRef.current = ivsStreams;
                localTrackIdsRef.current = new Set(activeTracks.map(t => t.id));
                setLocalStreams(ivsStreams);
            } catch (err) {
                console.error('Camera/mic access failed', err);
            }
        };

        init();
        return () => { activeTracks.forEach(t => t.stop()); };
    }, []);

    // Step 2: Join/leave IVS stage — only depends on matchData (token), NOT localStreams state
    useEffect(() => {
        if (!matchData?.participantToken) {
            // No match — leave any existing stage
            if (stageRef.current) {
                stageRef.current.leave();
                stageRef.current = null;
            }
            setRemoteParticipants(new Map());
            return;
        }

        // Always leave the previous stage before joining a new one
        if (stageRef.current) {
            stageRef.current.leave();
            stageRef.current = null;
        }
        setRemoteParticipants(new Map());

        const stage = new Stage(matchData.participantToken, {
            stageStreamsToPublish: () => localStreamsRef.current,
            shouldPublishParticipant: () => true,
            shouldSubscribeToParticipant: () => SubscribeType.AUDIO_VIDEO,
        });

        stageRef.current = stage;

        stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_ADDED, (participant: any, streams: any[]) => {
            if (participant.isLocal || stageRef.current !== stage) return;
            // Skip if any track matches our own local camera/mic tracks
            const isOwnStream = streams.some(s =>
                localTrackIdsRef.current.has(s.mediaStreamTrack?.id)
            );
            if (isOwnStream) return;
            // Upsert into Map — same ID can never produce two entries
            setRemoteParticipants(prev => new Map(prev).set(participant.id, streams));
        });

        stage.on(StageEvents.STAGE_PARTICIPANT_STREAMS_REMOVED, (participant: any) => {
            if (stageRef.current !== stage) return;
            setRemoteParticipants(prev => {
                const next = new Map(prev);
                next.delete(participant.id);
                return next;
            });
        });

        stage.join().catch(err => console.error('IVS join error:', err));

        return () => {
            stage.leave();
            if (stageRef.current === stage) stageRef.current = null;
            setRemoteParticipants(new Map());
        };
    }, [matchData?.participantToken]); // only re-run when the token changes

    const totalPeople = 1 + remoteParticipants.size;
    const isTwoPersonRoom = matchData && totalPeople === 2;

    let gridClass = 'grid-cols-1';
    if (matchData && (totalPeople === 3 || totalPeople === 4)) gridClass = 'grid-cols-2 sm:grid-rows-2';
    else if (matchData && totalPeople > 4) gridClass = 'grid-cols-3 sm:grid-rows-2';

    if (isTwoPersonRoom) {
        return (
            <div className="w-full h-full max-h-[85vh] flex flex-row items-center justify-center gap-4 relative">
                {localStreams.length > 0 && <VideoPlayer streams={localStreams} isLocal={true} portrait />}
                {Array.from(remoteParticipants.entries()).map(([id, streams]) => (
                    <VideoPlayer key={id} streams={streams} isLocal={false} portrait />
                ))}
            </div>
        );
    }

    return (
        <div className={`w-full h-full max-h-[85vh] grid gap-4 relative ${gridClass}`}>
            {!matchData && localStreams.length > 0 && (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <h2 className="text-2xl font-bold text-white drop-shadow-md">
                        {isConnected ? 'Searching for a room...' : 'Connecting to server...'}
                    </h2>
                </div>
            )}

            {localStreams.length > 0 && (
                <VideoPlayer streams={localStreams} isLocal={true} />
            )}

            {matchData && Array.from(remoteParticipants.entries()).map(([id, streams]) => (
                <VideoPlayer key={id} streams={streams} isLocal={false} />
            ))}
        </div>
    );
};
