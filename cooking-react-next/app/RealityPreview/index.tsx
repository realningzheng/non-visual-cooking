"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import LinearProgress from '@mui/material/LinearProgress';
import * as utils from '../utils';


interface RealityPreviewProps {
    setRealityImageBase64: (base64: string) => void;
    setRealityEvaluateResponse: (response: { "gptResponse": string, "formattedResponse": string | null }) => void;
    setIsEvaluating: (isEvaluating: boolean) => void;
    setFetchedSentences: (sentences: number[]) => void;
    setIsFetchingSentences: (isFetching: boolean) => void;
    setFetchSentenceContent: (content: string) => void;
    realityImageBase64: string;
    realityEvaluateResponse: { "gptResponse": string, "formattedResponse": string | null };
    isEvaluating: boolean;
    fetchedSentences: number[];
    isFetchingSentences: boolean;
    fetchSentenceContent: string;
}


export default function RealityPreview(props: RealityPreviewProps) {
    const [isClient, setIsClient] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

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


    const captureRealityFrame = () => {
        props.setRealityEvaluateResponse({ "gptResponse": "", "formattedResponse": null });
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas && video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            // save the image to base64 string
            const base64data = canvas.toDataURL('image/png');
            props.setRealityImageBase64(base64data);
        }
    };


    // const evaluateRealityFrame = async (base64Reality: string) => {
    //     var prompt = 'What is inside the picture?';
    //     props.setIsEvaluating(true);
    //     let response = await utils.callGpt4V(prompt, [base64Reality]);
    //     props.setIsEvaluating(false);
    //     props.setRealityEvaluateResponse(response);
    // };


    // const fetchSentenceFromVideo = async (sentence: string) => {
    //     props.setIsFetchingSentences(true);
    //     let response = await utils.findSentenceFromTranscript(sentence);
    //     props.setIsFetchingSentences(false);
    //     console.log(response);
    //     props.setFetchedSentences(response.sentence_IDs);
    // };


    return (
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

            {/* <p>from video</p>
            <img
                src="images/normalcookedsteak.png"
                alt="Video"
                onClick={convertImageToBase64Video}
                style={{ width: '18vw', height: 'auto', margin: 'auto', border: '5px solid orange', cursor: 'pointer' }}
            /> */}

            {/* <div>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => evaluateRealityFrame(props.realityImageBase64)}
                >
                    Evaluating
                </Button>
                {
                    props.isEvaluating
                        ? <LinearProgress sx={{ mt: 2, mb: 4, width: '70%' }} />
                        : <div>
                            <p>{props.realityEvaluateResponse.gptResponse}</p>
                            <p>{props.realityEvaluateResponse.formattedResponse}</p>
                        </div>
                }

                <Stack spacing={2} justifyContent={'center'}>
                    <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => { fetchSentenceFromVideo(props.fetchSentenceContent) }}
                        style={{ width: '30%' }}
                    >
                        Video replay
                    </Button>
                    <TextField
                        id="outlined-basic"
                        label="Sentence"
                        variant="outlined"
                        value={props.fetchSentenceContent}
                        onChange={(e) => props.setFetchSentenceContent(e.target.value)}
                        style={{ width: '70%' }}
                    />
                    {
                        props.isFetchingSentences
                            ? <LinearProgress sx={{ mt: 2, mb: 4 }} />
                            : props.fetchedSentences.map((sentenceID) => (
                                <p key={sentenceID}>{sentenceID}:{transriptSentenceList[sentenceID]['text']}</p>
                            ))
                    }
                </Stack>
            </div> */}
        </Stack >
    );
}