"use client";

import { Button, Grid, Stack, Box } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import LinearProgress from '@mui/material/LinearProgress';
import { findSentenceFromTranscript, callGpt4V } from '../utils';
import ReactPlayer from 'react-player'
import { orange } from '@mui/material/colors';

const imagePathReality = 'images/overcookedsteak.png';
const imagePathVideo = 'images/normalcookedsteak.png';

interface RealityPreviewProps {
    setIsPlaying: (isPlaying: boolean) => void;
}

export default function RealityPreview(props: RealityPreviewProps) {
    const [isClient, setIsClient] = useState(false);
    const [base64Video, setBase64ForVideo] = useState('');
    const [userClickReasoning, setUserClickReasoning] = useState(false);
    const [realityImageBase64, setRealityImageBase64] = useState('');

    const [realityEvaluateResponse, setRealityEvaluateResponse] = useState('');
    const [isEvaluating, setIsEvaluating] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // set up client state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);


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


    useEffect(() => {
        getVideo();
    }, [videoRef]);


    useEffect(() => {
        const fetchSentence = async () => {
            let response = await findSentenceFromTranscript('Making a steak that is not overcooked.');

            // Do something with the response here
            console.log(response);
        };

        // Call the async function
        fetchSentence();

    }, [userClickReasoning]);


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
        setRealityEvaluateResponse('');
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


    const evaluateRealityFrame = async (base64Reality:string) => {
        var prompt = 'What is inside the picture?';
        setIsEvaluating(true);
        let response = await callGpt4V(prompt, [base64Reality]);
        setIsEvaluating(false);
        setRealityEvaluateResponse(response);
        console.log(response);
    };


    const CompareRealityAndVideoFrame = async () => {
        var prompt = 'Compare the two pictures. The first picture is what I cooked, '
            + 'the second picture is what is supposed to look like. '
            + 'Tell me what is wrong with what I cooked. ';

        // Make sure callGpt4V is defined to accept the second parameter as an array
        let response = await callGpt4V(prompt, [realityImageBase64, base64Video]);

        // Do something with the response here
        console.log(response);
    };

    return (
        <Stack spacing={2} justifyContent={'center'}>
            {isClient && <video ref={videoRef} style={{ width: '100%', height: 'auto' }} />}
            <canvas
                ref={canvasRef}
                style={{ display: 'none' }}
            />
            <Box display={'flex'} justifyContent={'center'} width={'100%'}>
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
            <Grid container spacing={1}>
                <Grid item xs={6}>
                    <p>from reality</p>
                    <img
                        // src="images/overcookedsteak.png"
                        src={realityImageBase64}
                        alt="Reality"
                        onClick={convertImageToBase64Reality}
                        style={{ width: '18vw', height: 'auto', margin: 'auto', border: '5px solid orange', cursor: 'pointer' }}
                    />
                </Grid>
                <Grid item xs={6}>
                    <p>from video</p>
                    <img
                        src="images/normalcookedsteak.png"
                        alt="Video"
                        onClick={convertImageToBase64Video}
                        style={{ width: '18vw', height: 'auto', margin: 'auto', border: '5px solid orange', cursor: 'pointer' }}
                    />
                </Grid>
            </Grid>

            {/* <Stack spacing={2} justifyContent={'center'}> */}
            <div>
                <Button
                    variant="contained"
                    color="secondary"
                    onClick={()=>evaluateRealityFrame(realityImageBase64)}>
                    Evaluate
                </Button>
                {isEvaluating ? <LinearProgress sx={{mt:2, mb:4}}/>: <p>{realityEvaluateResponse}</p>}

                <Button variant="contained" color="success" onClick={() => { setUserClickReasoning(!userClickReasoning) }}>
                    Reasoning
                </Button>
                <Button variant="outlined" color="success">
                    Forward
                </Button>
                <Button variant="outlined" color="success">
                    Backward
                </Button>
            </div>
            {/* </Stack> */}
        </Stack >
    );
}