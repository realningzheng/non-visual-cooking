"use client";

import { Button, Grid, Stack } from "@mui/material";
import { useState, useEffect } from "react";
import { findSentenceFromTranscript, callGpt4V } from '../utils';

const imagePathReality = 'images/overcookedsteak.png';
const imagePathVideo = 'images/normalcookedsteak.png';

interface RealityPreviewProps {
    setIsPlaying: (isPlaying: boolean) => void;
}

export default function RealityPreview(props: RealityPreviewProps) {
    const [base64Reality, setBase64ForReality] = useState('');
    const [base64Video, setBase64ForVideo] = useState('');
    const [userClickEvaluate, setUserClickEvaluate] = useState(false);
    const [userClickReasoning, setUserClickReasoning] = useState(false);

    useEffect(() => {
        // Define an asynchronous function inside useEffect
        const fetchData = async () => {
            var prompt = 'Compare the two pictures. The first picture is what I cooked, '
                + 'the second picture is what is supposed to look like. '
                + 'Tell me what is wrong with what I cooked. ';

            // Make sure callGpt4V is defined to accept the second parameter as an array
            let response = await callGpt4V(prompt, [base64Reality, base64Video]);

            // Do something with the response here
            console.log(response);
        };

        // Call the async function
        fetchData();

    }, [userClickEvaluate, base64Reality, base64Video]);

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
                    setBase64ForReality(String(base64data)); // Set the base64 string
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

    return (
        <Stack spacing={2} justifyContent={'center'}>
            {/* Image captured from reality */}
            <Grid container spacing={3}>
                <Grid item xs={6}>
                    <img
                        src="images/overcookedsteak.png"
                        alt="Reality"
                        onClick={convertImageToBase64Reality}
                        style={{ width: '70%', height: 'auto', margin: 'auto', border: '5px solid orange', cursor: 'pointer' }}
                    />
                </Grid>
                <Grid item xs={6}>
                    <img
                        src="images/normalcookedsteak.png"
                        alt="Reality"
                        onClick={convertImageToBase64Video}
                        style={{ width: '70%', height: 'auto', margin: 'auto', border: '5px solid red', cursor: 'pointer' }}
                    />
                </Grid>
            </Grid>

            {/* <Stack spacing={2} justifyContent={'center'}> */}
            <div>
                <Button variant="contained" color="primary" onClick={() => { props.setIsPlaying(true) }}>
                    Play
                </Button>
                <Button variant="contained" color="primary" onClick={() => { props.setIsPlaying(false) }}>
                    Pause
                </Button>
                <p></p>
                <Button variant="contained" color="secondary" onClick={() => { setUserClickEvaluate(!userClickEvaluate) }}>
                    Evaluate
                </Button>
                <p></p>
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