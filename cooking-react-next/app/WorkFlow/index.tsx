"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import LinearProgress from '@mui/material/LinearProgress';
import * as utils from '../utils';

export default function WorkFlow() {
    const [fetchUserVoiceInput, setfetchUserVoiceInput] = useState("");
    const [fetchUserStreamInput, setfetchUserStreamInput] = useState("");

    return (
        <div>
            <h2>Work Flow</h2>
            <h3>User Voice Input</h3>
            <TextField
                id="outlined-basic"
                label="Sentence"
                variant="outlined"
                value={fetchUserVoiceInput}
                onChange={(e) => setfetchUserVoiceInput(e.target.value)}
                style={{ width: '50%' }}
            />
            <h3>User Stream Input</h3>
            <TextField
                id="outlined-basic"
                label="Sentence"
                variant="outlined"
                value={fetchUserStreamInput}
                onChange={(e) => setfetchUserStreamInput(e.target.value)}
                style={{ width: '50%' }}
            />
            <h3>Send</h3>
            <Button
                variant="contained"
                color="secondary"
                onClick={() => { console.log('send action') }}
                style={{ width: '30%' }}
            >
                send
            </Button>
            <h3>Current State</h3>
        </div>
    );
}