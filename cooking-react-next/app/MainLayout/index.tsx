"use client";

import React, { useRef } from 'react';
import { useState, useEffect } from 'react';
import { Button, Stack, Box, TextField } from "@mui/material";
import Grid from '@mui/material/Grid2';
import VideoPreview from '../VideoPreview';
import WorkFlow from '../WorkFlow';
// hardcoded video knowledge data
import videoKnowledgeData from "../data/rwYaDqXFH88_video_knowledge_brief.json";


export default function MainLayout() {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [realityImageBase64, setRealityImageBase64] = useState('');

    // Workflow states
    const [voiceInputTranscript, setVoiceInputTranscript] = useState("");
    const [videoKnowledgeInput, setVideoKnowledgeInput] = useState("");
    const [currentState, setCurrentState] = useState(0);
    const [stateMachineEvent, setStateMachineEvent] = useState(-1);
    const [stateFunctionExeRes, setStateFunctionExeRes] = useState("");

    const [isClient, setIsClient] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // hardcoded video knowledge input
    useEffect(() => {
        setVideoKnowledgeInput(JSON.stringify(videoKnowledgeData, null, 2));
        // console.log("videoKnowledgeData", videoKnowledgeData);
    }, []);

    // set up client state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);

    useEffect(() => {
        getVideo();
    }, [videoRef]);


    const getVideo = () => {
        navigator.mediaDevices
            .getUserMedia({
                video: { width: 1280, height: 720 }
            })
            .then(stream => {
                let video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    video.play();
                }
            })
            .catch(err => {
                console.error(err);
            })
    }


    const captureRealityFrame = async (): Promise<string> => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas && video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            // save the image to base64 string
            const base64data = canvas.toDataURL('image/png');
            setRealityImageBase64(base64data);
            return base64data;
        }
        return '';
    };


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
                <Stack spacing={2} justifyContent={'center'}>
                    {isClient &&
                        <div style={{ width: 'auto', height: '30vh', position: 'relative' }}>
                            <video ref={videoRef} style={{ width: '100%', height: '100%', position: 'absolute', zIndex: -1, margin: 'auto' }} />
                        </div>
                    }
                    <canvas
                        ref={canvasRef}
                        style={{ display: 'none' }}
                    />
                    <Box
                        display={'flex'}
                        justifyContent={'center'}
                        width={'100%'}
                    >
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => { videoRef.current?.play() }}
                            sx={{ mr: 1 }}
                        >
                            Reality Play
                        </Button>
                        <Button
                            variant="outlined"
                            color="primary"
                            onClick={() => { videoRef.current?.pause() }}
                            sx={{ mr: 1, ml: 1 }}
                        >
                            Reality Pause
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            onClick={captureRealityFrame}
                            sx={{ ml: 1 }}
                        >
                            Capture Reality
                        </Button>
                    </Box>
                </Stack >
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
                    captureRealityFrame={captureRealityFrame}
                />
            </Grid>
        </Grid>
    )
}