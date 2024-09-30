"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import LinearProgress from '@mui/material/LinearProgress';
import * as utils from '../utils';
// Hardcoded data for now
import transriptSentenceList from '../data/cooking_steak_sentence.json';

const imagePathReality = 'images/overcookedsteak.png';
const imagePathVideo = 'images/normalcookedsteak.png';

interface RealityPreviewProps {
    setIsPlaying: (isPlaying: boolean) => void;
}

export default function RealityPreview(props: RealityPreviewProps) {
    const [isClient, setIsClient] = useState(false);
    const [base64Video, setBase64ForVideo] = useState('');

    const [realityImageBase64, setRealityImageBase64] = useState('');
    const [realityEvaluateResponse, setRealityEvaluateResponse] = useState({ "gptResponse": "", "formattedResponse": null });
    const [isEvaluating, setIsEvaluating] = useState(false);

    const [fetchedSentences, setFetchedSentences] = useState<number[]>([]);
    const [isFetchingSentences, setIsFetchingSentences] = useState(false);
    const [fetchSentenceContent, setFetchSentenceContent] = useState('Making a steak that is not overcooked.');

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


    const convertImageToBase64Reality = () => {
        // Fetch the image from the public folder
        fetch(imagePathReality)
            .then(response => response.blob()) // Convert the response to a blob
            .then(blob => {
                // Create a new FileReader object
                const reader = new FileReader();
                reader.readAsDataURL(blob); // Read the blob as a Data URL (base64)
                reader.onloadend = function () {
                    const base64data = reader.result;
                    setRealityImageBase64(String(base64data)); // Set the base64 string
                }
            })
            .catch(error => console.error('Error:', error));
    };


    const convertImageToBase64Video = () => {
        // Fetch the image from the public folder
        fetch(imagePathVideo)
            .then(response => response.blob()) // Convert the response to a blob
            .then(blob => {
                // Create a new FileReader object
                const reader = new FileReader();
                reader.readAsDataURL(blob); // Read the blob as a Data URL (base64)
                reader.onloadend = function () {
                    const base64data = reader.result;
                    setBase64ForVideo(String(base64data)); // Set the base64 string
                }
            })
            .catch(error => console.error('Error:', error));
    };


    const captureFrame = () => {
        setRealityEvaluateResponse({ "gptResponse": "", "formattedResponse": null });
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (canvas && video) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            // save the image to base64 string
            const base64data = canvas.toDataURL('image/png');
            setRealityImageBase64(base64data);
        }
    };


    const evaluateRealityFrame = async (base64Reality: string) => {
        var prompt = 'What is inside the picture?';
        setIsEvaluating(true);
        let response = await utils.callGpt4V(prompt, [base64Reality]);
        setIsEvaluating(false);
        setRealityEvaluateResponse(response);
    };


    const fetchSentenceFromVideo = async (sentence: string) => {
        setIsFetchingSentences(true);
        let response = await utils.findSentenceFromTranscript(sentence);
        setIsFetchingSentences(false);
        console.log(response);
        setFetchedSentences(response.sentence_IDs);
    };


    const CompareRealityAndVideoFrame = async () => {
        var prompt = 'Compare the two pictures. The first picture is what I cooked, '
            + 'the second picture is what is supposed to look like. '
            + 'Tell me what is wrong with what I cooked. ';

        // Make sure callGpt4V is defined to accept the second parameter as an array
        let response = await utils.callGpt4V(prompt, [realityImageBase64, base64Video]);

        // Do something with the response here
        console.log(response);
    };

    return (
        <Stack spacing={2} justifyContent={'center'}>
            {/* {isClient &&
                <div style={{ width: 'auto', height: '30vh', position: 'relative' }}>
                    <video ref={videoRef} style={{ width: '100%', height: '100%', position: 'absolute', zIndex: -1, margin:'auto' }} />
                    <img
                        // src="images/overcookedsteak.png"
                        src={realityImageBase64}
                        alt="Reality"
                        onClick={convertImageToBase64Reality}
                        style={{ width: '15vw', right: '10px', top: '5px', height: 'auto', position: 'absolute', border: '5px solid orange', cursor: 'pointer', zIndex: 3 }}
                    />
                </div>
            }
            <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
            /> */}
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
                    onClick={captureFrame}
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
            
            <div>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => evaluateRealityFrame(realityImageBase64)}
                >
                    Evaluating
                </Button>
                {
                    isEvaluating
                        ? <LinearProgress sx={{ mt: 2, mb: 4, width:'70%' }} />
                        : <div>
                            <p>{realityEvaluateResponse.gptResponse}</p>
                            <p>{realityEvaluateResponse.formattedResponse}</p>
                        </div>
                }
                <Stack spacing={2} justifyContent={'center'}>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => { fetchSentenceFromVideo(fetchSentenceContent) }}
                    style={{ width: '30%' }}
                >
                    Fetch related sentences
                </Button>
                <TextField
                    id="outlined-basic"
                    label="Sentence"
                    variant="outlined"
                    value={fetchSentenceContent}
                    onChange={(e) => setFetchSentenceContent(e.target.value)}
                    style={{ width: '70%' }}
                />
                {
                    isFetchingSentences
                        ? <LinearProgress sx={{ mt: 2, mb: 4 }} />
                        : fetchedSentences.map((sentenceID) => (
                            <p key={sentenceID}>{sentenceID}:{transriptSentenceList[sentenceID]['text']}</p>
                        ))
                }
                </Stack>
            </div>
        </Stack >
    );
}