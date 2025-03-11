/**
 * Common utility functions
 */

/**
 * Parses video segments from agent response
 * @param agentResponse - The agent's response string
 * @param videoKnowledgeInput - The video knowledge input string
 * @returns Array of parsed video segments or empty array if parsing fails
 */
export const parseVideoSegments = (agentResponse: string, videoKnowledgeInput: string) => {
    try {
        if (agentResponse.length > 0) {
            const parsedRes = JSON.parse(agentResponse);
            if (!parsedRes.video_segment_index || !Array.isArray(parsedRes.video_segment_index)) {
                return [];
            }

            const videoSegments = parsedRes.video_segment_index
                .sort((a: number, b: number) => a - b)
                .map((item: number) => {
                    try {
                        const videoKnowledge = JSON.parse(videoKnowledgeInput);
                        const clip = videoKnowledge.find((s: any) => s.index === item);
                        if (!clip) return null;

                        const text = clip.video_transcript;
                        const startTime = clip.segment[0];
                        const endTime = clip.segment[1];
                        return {
                            sentenceIndex: item,
                            text: text,
                            startTime: startTime,
                            endTime: endTime
                        };
                    } catch (error) {
                        console.error('Error parsing video segment:', error);
                        return null;
                    }
                })
                .filter(Boolean);

            return videoSegments;
        } else {
            return [];
        }
    } catch (error) {
        console.error('Error parsing agent response:', error);
        return [];
    }
};

/**
 * Extracts procedure sequence from video knowledge
 * @param videoKnowledge - The video knowledge string
 * @returns Array of procedure steps or empty array if parsing fails
 */
export const extractProcedureSequence = (videoKnowledge: string): string[] => {
    try {
        const parsedKnowledge = JSON.parse(videoKnowledge);
        const procedureSet = new Set<string>();

        parsedKnowledge.forEach((item: any) => {
            if (item.procedure) {
                procedureSet.add(item.procedure);
            }
        });

        return Array.from(procedureSet);
    } catch (error) {
        console.error('Error extracting procedure sequence:', error);
        return [];
    }
};

/**
 * Safely captures a frame from a video element
 * @param videoRef - Reference to the video element
 * @param canvasRef - Reference to the canvas element
 * @param currentBase64 - Current base64 image string (fallback)
 * @returns Promise resolving to base64 string of captured frame
 */
export const captureVideoFrame = async (
    videoRef: React.RefObject<HTMLVideoElement>,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    currentBase64: string
): Promise<string> => {
    if (!videoRef.current || !canvasRef.current) {
        return currentBase64;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            console.error('Could not get canvas context');
            return currentBase64;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const base64data = canvas.toDataURL('image/png');
        return base64data;
    } catch (error) {
        console.error('Error capturing video frame:', error);
        return currentBase64;
    }
}; 