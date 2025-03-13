/**
 * Common type definitions used across the application
 */

// Transcript sentence item for video segments
export interface TranscriptSentenceItem {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

// Interaction memory items for conversation history
export interface InteractionMemoryItem {
    user_query?: string;
    agent_response?: string; 
    video_segment_index?: number[];
}

// Auto agent response items for automated analysis
export interface AutoAgentResponseItem {
    isValidCookingStep: boolean;
    isStepCorrect: boolean;
    isCorrectProcedureOrder: boolean;
    hasProgressedToProcedure: boolean;
    procedureAnalysis: string;
    stepAnalysis: string;
    foodAndKitchenwareAnalysis: string;
    audioAnalysis: string;
    improvementInstructions: string;
}

// Combined memory item is either an interaction memory item or an auto agent response item with a timestamp
export type CombinedMemoryItem = {
    index: number;
    type: 'user interaction' | 'automatic reality analysis result';
    content: InteractionMemoryItem | AutoAgentResponseItem;
    timestamp: string;
}
    
// Reality preview props
export interface RealityPreviewProps {
    isClient: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    realityImageBase64: string;
} 