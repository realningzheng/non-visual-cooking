/**
 * Custom hook for managing video state
 */
import { useState, useEffect } from 'react';
import { TranscriptSentenceItem } from '../types/common';
import { parseVideoSegments } from '../utils';
import { DEFAULT_VIDEO_URL } from '../constants';

interface UseVideoStateProps {
    agentResponse: string;
    videoKnowledgeInput: string;
    currentState: number;
}

interface UseVideoStateResult {
    videoUrl: string;
    videoSegments: TranscriptSentenceItem[];
    playSeconds: number;
    currentSentenceIndex: number;
    showRawVideo: boolean;
    verticalCaptions: boolean;
    segmentedVideoPlaying: boolean;
    replaySignal: boolean;
    setVideoUrl: (url: string) => void;
    setPlaySeconds: (seconds: number) => void;
    setCurrentSentenceIndex: (index: number) => void;
    setShowRawVideo: (show: boolean) => void;
    setVerticalCaptions: (vertical: boolean) => void;
    setSegmentedVideoPlaying: (playing: boolean) => void;
    setReplaySignal: (replay: boolean) => void;
    updateCurrentSentenceFromPlayback: (seconds: number) => void;
}

export function useVideoState({
    agentResponse,
    videoKnowledgeInput,
    currentState
}: UseVideoStateProps): UseVideoStateResult {
    // Video state
    const [videoUrl, setVideoUrl] = useState<string>(DEFAULT_VIDEO_URL);
    const [videoSegments, setVideoSegments] = useState<TranscriptSentenceItem[]>([]);
    const [playSeconds, setPlaySeconds] = useState<number>(0);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
    const [showRawVideo, setShowRawVideo] = useState<boolean>(true);
    const [verticalCaptions, setVerticalCaptions] = useState<boolean>(false);
    const [segmentedVideoPlaying, setSegmentedVideoPlaying] = useState<boolean>(false);
    const [replaySignal, setReplaySignal] = useState<boolean>(false);

    // Parse video segments from agent response
    useEffect(() => {
        const segments = parseVideoSegments(agentResponse, videoKnowledgeInput);
        if (segments.length > 0) {
            console.log('[set video segments]', segments);
            setVideoSegments(segments);
            setPlaySeconds(0);
        } else {
            setVideoSegments([]);
            setPlaySeconds(0);
        }
    }, [agentResponse, videoKnowledgeInput, currentState]);

    // Function to update current sentence based on playback position
    const updateCurrentSentenceFromPlayback = (seconds: number) => {
        if (videoSegments.length > 0) {
            const currentSentence = videoSegments.find((item: TranscriptSentenceItem) => {
                return item &&
                    seconds >= Number(item.startTime) / 1000 &&
                    seconds <= Number(item.endTime) / 1000;
            });
            
            if (currentSentence) {
                setCurrentSentenceIndex(currentSentence.sentenceIndex);
                const element = document.getElementById(`sentence-${currentSentence.sentenceIndex}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    };

    // Update current sentence index based on playback position
    useEffect(() => {
        updateCurrentSentenceFromPlayback(playSeconds);
    }, [playSeconds, videoSegments]);

    return {
        videoUrl,
        videoSegments,
        playSeconds,
        currentSentenceIndex,
        showRawVideo,
        verticalCaptions,
        segmentedVideoPlaying,
        replaySignal,
        setVideoUrl,
        setPlaySeconds,
        setCurrentSentenceIndex,
        setShowRawVideo,
        setVerticalCaptions,
        setSegmentedVideoPlaying,
        setReplaySignal,
        updateCurrentSentenceFromPlayback
    };
} 