"use client";

import React, { useRef } from 'react';
import { useState, useEffect } from 'react';
import { Button, Stack, Box, TextField } from "@mui/material";
import Grid from '@mui/material/Grid2';
import VideoPreview from '../VideoPreview';
import WorkFlow from '../WorkFlow';
// hardcoded video knowledge data
import videoKnowledgeData from "../data/rwYaDqXFH88_video_knowledge_brief.json";
import ImageUploader from '../RealityPreview/ImageUploader';
import RealityPreview from '../RealityPreview/RealityPreview';


export default function MainLayout() {
    // Reality preview states
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [realityImageBase64, setRealityImageBase64] = useState('');
    const [debugMode, setDebugMode] = useState(true);

    // Workflow states
    const [isProcessing, setIsProcessing] = useState(false);
    const [voiceInputTranscript, setVoiceInputTranscript] = useState("");
    const [videoKnowledgeInput, setVideoKnowledgeInput] = useState("");
    const [currentState, setCurrentState] = useState(-1);
    const [stateMachineEvent, setStateMachineEvent] = useState(-1);
    const [stateFunctionExeRes, setStateFunctionExeRes] = useState("");

    const [isClient, setIsClient] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);


    useEffect(() => {
        if (typeof window !== 'undefined') setIsClient(true);
        setVideoKnowledgeInput(JSON.stringify(videoKnowledgeData, null, 2));
    }, []);


    useEffect(() => {
        getVideo();
    }, [videoRef, debugMode]);


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
        if (debugMode) {
            return realityImageBase64;
        } else {
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
        }
        return '';
    };


    return (
        <Grid container spacing={3}>
            <Grid size={4}>
                <div className='text-2xl font-bold'>Video preview</div>
                <div style={{ width: '100%', margin: '0 auto' }}>
                    <VideoPreview
                        vurl='rwYaDqXFH88.mp4'
                        isVideoPlaying={isVideoPlaying}
                        currentState={currentState}
                        stateFunctionExeRes={stateFunctionExeRes}
                        setIsVideoPlaying={setIsVideoPlaying}
                    />
                </div>

                <div className='divider'></div>

                <div className='text-2xl font-bold flex items-center gap-2'>
                    Reality preview
                    <button
                        className={`btn btn-xs ${debugMode ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setDebugMode(!debugMode)}
                    >
                        Debug mode
                    </button>
                </div>
                {debugMode ?
                    <ImageUploader
                        realityImageBase64={realityImageBase64}
                        setRealityImageBase64={setRealityImageBase64}
                    /> :
                    <RealityPreview
                        isClient={isClient}
                        videoRef={videoRef}
                        canvasRef={canvasRef}
                        realityImageBase64={realityImageBase64}
                    />
                }
            </Grid>
            <Grid size={8} style={{ height: '100vh', overflow: 'scroll' }}>
                <WorkFlow
                    setIsProcessing={setIsProcessing}
                    setStateMachineEvent={setStateMachineEvent}
                    setCurrentState={setCurrentState}
                    setVoiceInputTranscript={setVoiceInputTranscript}
                    setVideoKnowledgeInput={setVideoKnowledgeInput}
                    setRealityImageBase64={setRealityImageBase64}
                    setStateFunctionExeRes={setStateFunctionExeRes}
                    captureRealityFrame={captureRealityFrame}
                    isProcessing={isProcessing}
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