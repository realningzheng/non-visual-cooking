"use client";

import React, { useRef } from 'react';
import { useState, useEffect } from 'react';
import { Button, Stack, Box, TextField } from "@mui/material";
import Grid from '@mui/material/Grid2';
import VideoPreview from '../VideoPreview';
import WorkFlow from '../WorkFlow';
import ImageUploader from '../RealityPreview/ImageUploader';
import RealityPreview from '../RealityPreview/RealityPreview';
import EvalResVis from '../EvalResVis';


import transriptSentenceList from '../data/rwYaDqXFH88_sentence.json';
import SegVideoPlayerComp from '../SegVideoPlayerComp/SegVideoPlayerComp';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

export default function MainLayout() {
    const [evalMode, setEvalMode] = useState(false);
    // original video states
    const [videoUrl, setVideoUrl] = useState('rwYaDqXFH88.mp4');
    const [videoSegments, setVideoSegments] = useState<TransriptSentenceItemProps[]>([]);
    const [playSeconds, setPlaySeconds] = useState<number>(0);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);
    const [showRawVideo, setShowRawVideo] = useState(true);
    const [verticalCaptions, setVerticalCaptions] = useState(false);

    // Reality preview states
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [realityImageBase64, setRealityImageBase64] = useState('');
    const [enableWebCam, setEnableWebCam] = useState(false);

    // Workflow states
    const [stateTransitionToggle, setStateTransitionToggle] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [voiceInputTranscript, setVoiceInputTranscript] = useState("");
    const [videoKnowledgeInput, setVideoKnowledgeInput] = useState("");
    const [currentState, setCurrentState] = useState(-1);
    const [stateMachineEvent, setStateMachineEvent] = useState(-1);
    const [stateFunctionExeRes, setStateFunctionExeRes] = useState("");
    const [ttsSpeed, setTtsSpeed] = useState(2);

    const [isClient, setIsClient] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);


    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);


    useEffect(() => {
        getVideo();
    }, [videoRef, !enableWebCam]);


    useEffect(() => {
        if (currentState === 6) {
            try {
                let parsedRes = JSON.parse(stateFunctionExeRes);
                setVideoSegments(parsedRes.map((item: number) => {
                    let clip = JSON.parse(videoKnowledgeInput).find((s: any) => s.index === item);
                    let text = clip.video_transcript;
                    let startTime = clip.segment[0];
                    let endTime = clip.segment[1];
                    return {
                        sentenceIndex: item,
                        text: text,
                        startTime: startTime,
                        endTime: endTime
                    };
                }));
                setPlaySeconds(0);  
            } catch (error) {
                setVideoSegments([]);
                setPlaySeconds(0);
            }
        }
    }, [stateFunctionExeRes, currentState]);


    useEffect(() => {
        if (currentState === 6 && videoSegments.length > 0) {
            const currentSentence = videoSegments.find((item: TransriptSentenceItemProps) => {
                return item &&
                    playSeconds >= Number(item.startTime) / 1000 &&
                    playSeconds <= Number(item.endTime) / 1000;
            });
            if (currentSentence) {
                setCurrentSentenceIndex(currentSentence.sentenceIndex);
                const element = document.getElementById(`sentence-${currentSentence.sentenceIndex}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [playSeconds]);


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
        if (!enableWebCam) {
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
            <Grid size={5}>
                <div className='text-xl font-bold flex items-center gap-2 p-1'>
                    VIDEO PREVIEW
                    <button
                        className={`btn btn-xs ${showRawVideo ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setShowRawVideo(!showRawVideo)}
                    >
                        show raw video
                    </button>
                    <button
                        className={`btn btn-xs ${verticalCaptions ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setVerticalCaptions(!verticalCaptions)}
                    >
                        vertical captions
                    </button>
                </div>
                <div style={{ width: '70%', margin: '0 auto' }}>
                    {showRawVideo &&
                        <VideoPreview
                            vurl={videoUrl}
                            isVideoPlaying={isVideoPlaying}
                            setIsVideoPlaying={setIsVideoPlaying}
                        />
                    }
                </div>
                <div className='p-1.5' />
                <div>
                    <SegVideoPlayerComp
                        sourceUrl={videoUrl}
                        videoSegments={videoSegments}
                        currentSentenceIndex={currentSentenceIndex}
                        verticalCaptions={verticalCaptions}
                        currentState={currentState}
                        setPlaySeconds={setPlaySeconds}
                    />
                </div>

                <div className='divider'></div>

                <div className='text-xl font-bold flex items-center gap-2 p-1'>
                    REALITY PREVIEW
                    <button
                        className={`btn btn-xs ${enableWebCam ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => setEnableWebCam(!enableWebCam)}
                    >
                        web cam
                    </button>
                    <button
                        className={`btn btn-xs ${evalMode ? 'btn-error' : 'btn-outline'}`}
                        onClick={() => setEvalMode(!evalMode)}
                    >
                        eval mode
                    </button>
                </div>
                {!enableWebCam ?
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
            <Grid size={7} style={{ height: '100vh', overflow: 'scroll' }}>
                {evalMode ?
                    <EvalResVis /> :
                    <WorkFlow
                        setStateTransitionToggle={setStateTransitionToggle}
                        setIsProcessing={setIsProcessing}
                        setStateMachineEvent={setStateMachineEvent}
                        setCurrentState={setCurrentState}
                        setVoiceInputTranscript={setVoiceInputTranscript}
                        setVideoKnowledgeInput={setVideoKnowledgeInput}
                        setRealityImageBase64={setRealityImageBase64}
                        setStateFunctionExeRes={setStateFunctionExeRes}
                        captureRealityFrame={captureRealityFrame}
                        setTtsSpeed={setTtsSpeed}
                        stateTransitionToggle={stateTransitionToggle}
                        isProcessing={isProcessing}
                        voiceInputTranscript={voiceInputTranscript}
                        videoKnowledgeInput={videoKnowledgeInput}
                        currentState={currentState}
                        stateMachineEvent={stateMachineEvent}
                        realityImageBase64={realityImageBase64}
                        stateFunctionExeRes={stateFunctionExeRes}
                        ttsSpeed={ttsSpeed}
                    />
                }
            </Grid>
        </Grid>
    )
}