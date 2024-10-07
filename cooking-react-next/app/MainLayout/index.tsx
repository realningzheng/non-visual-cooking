import React, { useRef } from 'react';
import { useState, useEffect } from 'react';
import { Grid } from '@mui/material';
import VideoPreview from '../VideoPreview';
import RealityPreview from '../RealityPreview';
import WorkFlow from '../WorkFlow';

export default function MainLayout() {
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
    const [currentState, setCurrentState] = useState(0);
    const [voiceInput, setVoiceInput] = useState("");
    const [streamInput, setStreamInput] = useState("");
    const [videoKnowledgeInput, setVideoKnowledgeInput] = useState("");
    const [userEvent, setUserEvent] = useState(-1);
    const [agentResponse, setAgentResponse] = useState("");

    return (
        <Grid container spacing={3}>
            <Grid item xs={6}>
                <h2>Video preview</h2>
                <VideoPreview
                    vurl='https://www.youtube.com/watch?v=umiOuVA7PEc'
                    isPlaying={isVideoPlaying}
                    setIsPlaying={setIsVideoPlaying}
                />
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
            <Grid item xs={6} style={{ height: '100vh', overflow: 'scroll' }}>
                <WorkFlow
                    setUserEvent={setUserEvent}
                    setCurrentState={setCurrentState}
                    setVoiceInput={setVoiceInput}
                    setVideoKnowledgeInput={setVideoKnowledgeInput}
                    setRealityImageBase64={setRealityImageBase64}
                    setAgentResponse={setAgentResponse}
                    voiceInput={voiceInput}
                    videoKnowledgeInput={videoKnowledgeInput}
                    currentState={currentState}
                    userEvent={userEvent}
                    realityImageBase64={realityImageBase64}
                    agentResponse={agentResponse}
                />
            </Grid>
        </Grid>
    )
}