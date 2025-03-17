import { useState, useEffect, useRef } from "react";

interface TTSPlayerProps {
    input: string;
    ttsSpeed: number;
}

export default function TTSPlayer(props: TTSPlayerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (props.input.trim().length === 0 && audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            setIsPlaying(false);
        }
    }, [props.input]);

    const playAudio = () => {
        if (!props.input.trim()) return;

        setIsPlaying(true);

        // Create audio source URL with the input
        const audioUrl = `/api/route?input=${encodeURIComponent(props.input)}&speed=${props.ttsSpeed}`;

        // Create and play audio
        if (!audioRef.current) {
            audioRef.current = new Audio();
        }

        audioRef.current.src = audioUrl;
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.play().catch(err => {
            console.error("Failed to play audio:", err);
            setIsPlaying(false);
        });
    };

    // Auto-trigger speech with debounce when input changes
    useEffect(() => {
        // Clear any existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Don't trigger for empty input
        if (!props.input.trim()) return;

        // Set a small delay to avoid triggering while still typing
        timeoutRef.current = setTimeout(() => {
            if (!isPlaying) {
                playAudio();
            }
        }, 200); // 200ms debounce

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [props.input]);

    return (
        <div className="flex flex-col space-y-4">
            <div className="flex space-x-2">
                <textarea
                    value={props.input}
                    disabled={true}
                    className="w-full p-3 border border-gray-200 rounded-md shadow-sm resize-y"
                    rows={5}
                />
            </div>

            {/* show audio controls */}
            {/* {isPlaying && (
                <div className="text-sm text-gray-600">
                    Playing audio...
                </div>
            )} */}
        </div>
    );
}
