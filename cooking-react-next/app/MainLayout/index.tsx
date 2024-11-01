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
    const [isProcessing, setIsProcessing] = useState(false);
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
                <div className='text-2xl font-bold'>Video preview</div>
                <div style={{ width: '70%', margin: '0 auto' }}>
                    <VideoPreview
                        vurl='https://www.youtube.com/watch?v=umiOuVA7PEc'
                        isVideoPlaying={isVideoPlaying}
                        setIsVideoPlaying={setIsVideoPlaying}
                    />
                </div>
                <div className='text-2xl font-bold'>Reality preview</div>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
                    <Stack spacing={0} justifyContent={'center'} sx={{ flex: 1 }}>
                        {isClient &&
                            <div style={{ width: '100%', height: '25vh', position: 'relative', backgroundColor: '#000000',borderRadius: '5px' }}>
                                <video ref={videoRef} style={{ width: '100%', height: '100%', position: 'absolute', zIndex: 1, objectFit: 'contain', margin: 'auto' }} />
                            </div>
                        }

                        <canvas
                            ref={canvasRef}
                            style={{ display: 'none' }}
                        />

                    </Stack>
                    <div style={{ flex: 1 }}>
                        {realityImageBase64 ? (
                            <img
                                src={realityImageBase64}
                                alt="Reality Capture"
                                style={{
                                    width: '100%',
                                    height: '25vh',
                                    objectFit: 'contain',
                                }}
                            />
                        ) : (
                            <div
                                style={{
                                    width: '100%',
                                    height: '25vh',
                                    border: '2px dashed #ccc',
                                    borderRadius: '5px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#f5f5f5',
                                }}
                            >
                                <span style={{ color: '#666', fontSize: '1.1rem' }}>
                                    No image captured yet
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <Box
                    display={'flex'}
                    justifyContent={'center'}
                    width={'100%'}
                    marginTop={'10px'}
                >
                    <button
                        className='btn btn-outline'
                        color="primary"
                        onClick={() => { videoRef.current?.play() }}
                        style={{ marginRight: 1 }}
                    >
                        Reality Play
                    </button>
                    <button
                        className='btn btn-outline'
                        color="primary"
                        onClick={() => { videoRef.current?.pause() }}
                        style={{ marginRight: 1, marginLeft: 1 }}
                    >
                        Reality Pause
                    </button>
                </Box>

            </Grid>
            <Grid size={6} style={{ height: '100vh', overflow: 'scroll' }}>
                <WorkFlow
                    setIsProcessing={setIsProcessing}
                    setStateMachineEvent={setStateMachineEvent}
                    setCurrentState={setCurrentState}
                    setVoiceInputTranscript={setVoiceInputTranscript}
                    setVideoKnowledgeInput={setVideoKnowledgeInput}
                    setRealityImageBase64={setRealityImageBase64}
                    setStateFunctionExeRes={setStateFunctionExeRes}
                    isProcessing={isProcessing}
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