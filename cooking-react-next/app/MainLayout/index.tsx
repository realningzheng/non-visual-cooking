"use client";

import React, { useState } from 'react';
import { Box, Typography } from "@mui/material";
import Grid from '@mui/material/Grid2';
import VideoPreview from '../VideoPreview';
import WorkFlow from '../WorkFlow';
import ImageUploader from '../RealityPreview/ImageUploader';
import RealityPreview from '../RealityPreview/RealityPreview';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import SegVideoPlayerComp from '../SegVideoPlayerComp/SegVideoPlayerComp';

// Import constants
import { 
    DEFAULT_TTS_SPEED, 
    INITIAL_STATE, 
    DEFAULT_EVENT,
    APP_TITLE 
} from '../constants';

// Import custom hooks
import { useVideoState } from '../hooks/use-video-state';
import { useRealityPreview } from '../hooks/use-reality-preview';

export default function MainLayout() {
    // Workflow state management
    const [stateTransitionToggle, setStateTransitionToggle] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [voiceInputTranscript, setVoiceInputTranscript] = useState<string>("");
    const [videoKnowledgeInput, setVideoKnowledgeInput] = useState<string>("");
    const [currentState, setCurrentState] = useState<number>(INITIAL_STATE);
    const [stateMachineEvent, setStateMachineEvent] = useState<number>(DEFAULT_EVENT);
    const [agentResponse, setAgentResponse] = useState<string>("");
    const [ttsSpeed, setTtsSpeed] = useState<number>(DEFAULT_TTS_SPEED);

    // Use custom hooks for video and reality preview
    const videoState = useVideoState({
        agentResponse,
        videoKnowledgeInput,
        currentState
    });

    const realityPreview = useRealityPreview();

    return (
        <>
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0.75rem',
                    background: 'linear-gradient(to right, #fff, #f5f5f5)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    borderRadius: '5px',
                    marginBottom: '1rem',
                }}
            >
                <RestaurantIcon
                    sx={{
                        fontSize: '2rem',
                        marginRight: '0.5rem',
                        color: '#d85a5a'
                    }}
                />
                <Typography
                    variant="h5"
                    sx={{
                        fontWeight: 'bold',
                        color: '#000',
                        letterSpacing: '0.5px',
                        fontFamily: '"Lucida Console", "Courier New"'
                    }}
                >
                    {APP_TITLE}
                </Typography>
            </Box>
            
            {/* Main Content */}
            <Grid container spacing={3}>
                {/* Left Column - Video and Reality Preview */}
                <Grid size={5}>
                    {/* Video Preview Section */}
                    <div className='text-xl font-bold flex items-center gap-2 p-1'>
                        VIDEO PREVIEW
                        <button
                            className={`btn btn-xs ${videoState.showRawVideo ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => videoState.setShowRawVideo(!videoState.showRawVideo)}
                        >
                            show raw video
                        </button>
                        <button
                            className={`btn btn-xs ${videoState.verticalCaptions ? 'btn-primary' : 'btn-outline'}`}
                            onClick={() => videoState.setVerticalCaptions(!videoState.verticalCaptions)}
                        >
                            vertical captions
                        </button>
                    </div>
                    
                    {/* Raw Video Player */}
                    <div style={{ width: '70%', margin: '0 auto' }}>
                        {videoState.showRawVideo &&
                            <VideoPreview
                                vurl={videoState.videoUrl}
                                isVideoPlaying={realityPreview.isVideoPlaying}
                                setIsVideoPlaying={realityPreview.setIsVideoPlaying}
                            />
                        }
                    </div>
                    <div className='p-1.5' />
                    
                    {/* Segmented Video Player */}
                    <div>
                        <SegVideoPlayerComp
                            sourceUrl={videoState.videoUrl}
                            videoSegments={videoState.videoSegments}
                            currentSentenceIndex={videoState.currentSentenceIndex}
                            verticalCaptions={videoState.verticalCaptions}
                            currentState={currentState}
                            segmentedVideoPlaying={videoState.segmentedVideoPlaying}
                            replaySignal={videoState.replaySignal}
                            setPlaySeconds={videoState.setPlaySeconds}
                        />
                    </div>

                    <div className='divider'></div>

                    {/* Reality Preview Section */}
                    <div className='text-xl font-bold flex items-center gap-2 p-1'>
                        REALITY PREVIEW
                    </div>
                    
                    {!realityPreview.videoStream ? (
                        <ImageUploader
                            realityImageBase64={realityPreview.realityImageBase64}
                            setRealityImageBase64={realityPreview.setRealityImageBase64}
                        />
                    ) : (
                        <RealityPreview
                            isClient={realityPreview.isClient}
                            videoRef={realityPreview.videoRef}
                            canvasRef={realityPreview.canvasRef}
                            realityImageBase64={realityPreview.realityImageBase64}
                        />
                    )}
                </Grid>
                
                {/* Right Column - Workflow */}
                <Grid size={7} style={{ height: '100vh', overflow: 'scroll' }}>
                    <WorkFlow
                        setStateTransitionToggle={setStateTransitionToggle}
                        setIsProcessing={setIsProcessing}
                        setStateMachineEvent={setStateMachineEvent}
                        setCurrentState={setCurrentState}
                        setVoiceInputTranscript={setVoiceInputTranscript}
                        setVideoKnowledgeInput={setVideoKnowledgeInput}
                        setRealityImageBase64={realityPreview.setRealityImageBase64}
                        setAgentResponse={setAgentResponse}
                        captureRealityFrame={realityPreview.captureRealityFrame}
                        setTtsSpeed={setTtsSpeed}
                        setSegmentedVideoPlaying={videoState.setSegmentedVideoPlaying}
                        setReplaySignal={videoState.setReplaySignal}
                        stateTransitionToggle={stateTransitionToggle}
                        isProcessing={isProcessing}
                        voiceInputTranscript={voiceInputTranscript}
                        videoKnowledgeInput={videoKnowledgeInput}
                        currentState={currentState}
                        stateMachineEvent={stateMachineEvent}
                        realityImageBase64={realityPreview.realityImageBase64}
                        agentResponse={agentResponse}
                        ttsSpeed={ttsSpeed}
                        replaySignal={videoState.replaySignal}
                        videoRef={realityPreview.videoRef}
                        setVideoStream={realityPreview.setVideoStream}
                    />
                </Grid>
            </Grid>
        </>
    );
}