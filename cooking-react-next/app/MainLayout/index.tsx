"use client";

import React, { useRef } from 'react';
import { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid2';
import VideoPreview from '../VideoPreview';
import RealityPreview from '../RealityPreview';
import WorkFlow from '../WorkFlow';

// hardcoded video knowledge data
import videoKnowledgeData from "../data/rwYaDqXFH88_video_knowledge_brief.json";

export default function MainLayout() {
    // Video preview states
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);

    // Reality preview states
    const [realityImageBase64, setRealityImageBase64] = useState('');
    const [realityEvaluateResponse, setRealityEvaluateResponse] = useState<{
        gptResponse: string;
        formattedResponse: string | null;
    }>({ gptResponse: '', formattedResponse: null });
    const [isEvaluating, setIsEvaluating] = useState(false);
    const [fetchedSentences, setFetchedSentences] = useState<number[]>([]);
    const [isFetchingSentences, setIsFetchingSentences] = useState(false);
    const [fetchSentenceContent, setFetchSentenceContent] = useState('Making a steak that is not overcooked.');

    // Workflow states
    const [voiceInputTranscript, setVoiceInputTranscript] = useState("");
    const [videoKnowledgeInput, setVideoKnowledgeInput] = useState("");
    const [currentState, setCurrentState] = useState(0);
    const [stateMachineEvent, setStateMachineEvent] = useState(-1);
    const [stateFunctionExeRes, setStateFunctionExeRes] = useState("");
    const [videoStreamInput, setVideoStreamInput] = useState("");

    // hardcoded video knowledge input
    useEffect(() => {
        setVideoKnowledgeInput(JSON.stringify(videoKnowledgeData, null, 2));
        // console.log("videoKnowledgeData", videoKnowledgeData);
      }, []);

    return (
        <Grid container spacing={3}>
            <Grid size={6}>
                <h2>Video preview</h2>
                <div style={{ width: '70%', margin: '0 auto' }}>
                    <VideoPreview
                        vurl='https://www.youtube.com/watch?v=umiOuVA7PEc'
                        isVideoPlaying={isVideoPlaying}
                        setIsVideoPlaying={setIsVideoPlaying}
                    />
                </div>
                <h2>Reality preview</h2>
                <RealityPreview
                    setRealityImageBase64={setRealityImageBase64}
                    setRealityEvaluateResponse={setRealityEvaluateResponse}
                    setIsEvaluating={setIsEvaluating}
                    setFetchedSentences={setFetchedSentences}
                    setIsFetchingSentences={setIsFetchingSentences}
                    setFetchSentenceContent={setFetchSentenceContent}
                    realityImageBase64={realityImageBase64}
                    realityEvaluateResponse={realityEvaluateResponse}
                    isEvaluating={isEvaluating}
                    fetchedSentences={fetchedSentences}
                    isFetchingSentences={isFetchingSentences}
                    fetchSentenceContent={fetchSentenceContent}
                />
            </Grid>
            <Grid size={6} style={{ height: '100vh', overflow: 'scroll' }}>
                <WorkFlow
                    setStateMachineEvent={setStateMachineEvent}
                    setCurrentState={setCurrentState}
                    setVoiceInputTranscript={setVoiceInputTranscript}
                    setVideoKnowledgeInput={setVideoKnowledgeInput}
                    setRealityImageBase64={setRealityImageBase64}
                    setStateFunctionExeRes={setStateFunctionExeRes}
                    voiceInputTranscript={voiceInputTranscript}
                    videoKnowledgeInput={videoKnowledgeInput}
                    currentState={currentState}
                    stateMachineEvent={stateMachineEvent}
                    realityImageBase64={realityImageBase64}
                    stateFunctionExeRes={stateFunctionExeRes}
                />
            </Grid>
        </Grid>
    )
}