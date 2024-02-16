import { Button, Grid, Stack } from "@mui/material";
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../reducers';
import {
    userStartVideoPlay,
    userClickEvaluate,
    userClickReasoning,
} from '../reducers/actions';
import { useState, useEffect } from "react";

const imagePathReality = 'images/overcookedsteak.png';
const imagePathVideo = 'images/normalcookedsteak.png';

export default function RealityPreview() {
    const dispatch = useDispatch();

    const [base64Reality, setBase64ForReality] = useState('');
    const [base64Video, setBase64ForVideo] = useState('');

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
                <Button variant="contained" color="primary" onClick={() => { dispatch(userStartVideoPlay(true)) }}>
                    Play
                </Button>
                <Button variant="contained" color="primary" onClick={() => { dispatch(userStartVideoPlay(false)) }}>
                    Pause
                </Button>
                <p></p>
                <Button variant="contained" color="secondary" onClick={() => { dispatch(userClickEvaluate('Compare the two pictures. The first picture is what I cooked, the second picture is what is supposed to look like. Tell me what is wrong with what I cooked. ', [base64Reality, base64Video])) }}>
                    Evaluate
                </Button>
                <p></p>
                <Button variant="contained" color="success" onClick={()=>{dispatch(userClickReasoning('Making a steak that is not overcooked". '))}}>
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
        </Stack>
    );
}