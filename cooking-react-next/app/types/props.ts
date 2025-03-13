/**
 * Component props definitions
 */
import { ReactNode, RefObject } from 'react';
import { CombinedMemoryItem } from './common';

// WorkFlow component props
export interface WorkFlowProps {
    setStateTransitionToggle: (input: boolean) => void;
    captureRealityFrame: () => Promise<string>;
    setStateMachineEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInputTranscript: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setRealityImageBase64: (input: string) => void;
    setAgentResponse: (input: string) => void;
    setIsProcessing: (input: boolean) => void;
    setTtsSpeed: (input: number) => void;
    setSegmentedVideoPlaying: (input: boolean) => void;
    setReplaySignal: (input: boolean) => void;
    stateTransitionToggle: boolean;
    voiceInputTranscript: string;
    videoKnowledgeInput: string;
    currentState: number;
    stateMachineEvent: number;
    realityImageBase64: string;
    agentResponse: string;
    isProcessing: boolean;
    ttsSpeed: number;
    replaySignal: boolean;
    videoRef: RefObject<HTMLVideoElement>;
    setVideoStream: (stream: MediaStream | null) => void;
}

// Video Preview component props
export interface VideoPreviewProps {
    vurl: string;
    isVideoPlaying: boolean;
    setIsVideoPlaying: (isPlaying: boolean) => void;
}

// Segmented Video Player component props
export interface SegVideoPlayerCompProps {
    sourceUrl: string;
    videoSegments: any[];
    currentSentenceIndex: number;
    verticalCaptions: boolean;
    currentState: number;
    segmentedVideoPlaying: boolean;
    replaySignal: boolean;
    setPlaySeconds: (seconds: number) => void;
}

// Image Uploader component props
export interface ImageUploaderProps {
    realityImageBase64: string;
    setRealityImageBase64: (base64: string) => void;
}

// Live API Provider props
export interface LiveAPIProviderProps {
    children: React.ReactNode;
    url?: string;
    apiKey: string;
} 

// Control Tray component props
export type ControlTrayProps = {
	videoRef: RefObject<HTMLVideoElement>;
	children?: ReactNode;
	supportsVideo: boolean;
	currentState: number;
	videoKnowledgeInput: string;
	combinedMemory: CombinedMemoryItem[];
	onVideoStreamChange?: (stream: MediaStream | null) => void;
	setStateMachineEvent: (event: number) => void;
	setCurrentState: (state: number) => void;
	connectConversation: () => Promise<void>;
	disconnectConversation: () => Promise<void>;
	setCombinedMemory: React.Dispatch<React.SetStateAction<CombinedMemoryItem[]>>;
	setVoiceInputTranscript: (transcript: string) => void;
	onDisconnect?: () => Promise<void>;
};