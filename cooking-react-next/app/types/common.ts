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
    index: number;
    user_query?: string;
    agent_response?: string;
    video_segment_index?: number[];
    memorized_item_key?: string;
    memorized_item_value?: string;
}

// Auto agent response items for automated analysis
export interface AutoAgentResponseItem {
    timeMS: number;
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

// Reality preview props
export interface RealityPreviewProps {
    isClient: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    realityImageBase64: string;
} 