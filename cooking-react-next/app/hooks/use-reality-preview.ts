/**
 * Custom hook for managing reality preview
 */
import { useState, useRef, useEffect } from 'react';
import { captureVideoFrame } from '../utils';

interface UseRealityPreviewResult {
    isClient: boolean;
    isVideoPlaying: boolean;
    realityImageBase64: string;
    videoStream: MediaStream | null;
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    setIsVideoPlaying: (isPlaying: boolean) => void;
    setRealityImageBase64: (base64: string) => void;
    setVideoStream: (stream: MediaStream | null) => void;
    captureRealityFrame: () => Promise<string>;
}

export function useRealityPreview(): UseRealityPreviewResult {
    // State
    const [isClient, setIsClient] = useState<boolean>(false);
    const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
    const [realityImageBase64, setRealityImageBase64] = useState<string>('');
    const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
    
    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Check if we're on the client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);

    // Clean up video stream on unmount
    useEffect(() => {
        return () => {
            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                setVideoStream(null);
            }
        };
    }, [videoStream]);

    // Function to capture a frame from the reality video
    const captureRealityFrame = async (): Promise<string> => {
        const capturedFrame = await captureVideoFrame(videoRef, canvasRef, realityImageBase64);
        if (capturedFrame) {
            setRealityImageBase64(capturedFrame);
        }
        return capturedFrame;
    };

    return {
        isClient,
        isVideoPlaying,
        realityImageBase64,
        videoStream,
        videoRef,
        canvasRef,
        setIsVideoPlaying,
        setRealityImageBase64,
        setVideoStream,
        captureRealityFrame
    };
} 