"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import LinearProgress from '@mui/material/LinearProgress';
import * as utils from '../utils';

import { stateTranslator, eventTranslator, stateMachine, stateFunctions } from './stateMachine';

export default function WorkFlow() {
    const [CurrentState, setCurrentState] = useState(0);
    const [VoiceInput, setVoiceInput] = useState("");
    const [StreamInput, setStreamInput] = useState("");
    const [UserEvent, setUserEvent] = useState(0);

    const gotoNextState = () => {
        // 1. (openai_api) Get the category of the user inputs (stream and voice)
        // TODO

        // 2. Proceed to next state
        setCurrentState(stateMachine[CurrentState][UserEvent]);
    };

    return (
        <div>
            <h2>Work Flow</h2>
            <h3>Voice Input</h3>
            <TextField
                id="outlined-basic"
                label="Sentence"
                variant="outlined"
                onChange={(e) => setVoiceInput(e.target.value)}
                style={{ width: '50%' }}
            />
            <h3>Stream Input</h3>
            <TextField
                id="outlined-basic"
                label="Stream JSON"
                variant="outlined"
                onChange={(e) => setStreamInput(e.target.value)}
                style={{ width: '50%' }}
            />
            <h3>Current State</h3>
            <p>{CurrentState} : {stateTranslator[Number(CurrentState)]}</p>
            <h3>Event</h3>
            <p>Choose from: </p>
            <ul style={{ display: 'flex', listStyleType: 'none', padding: 0 }}>
                {Object.keys(stateMachine[CurrentState])
                    .sort((a, b) => Number(a) - Number(b)) // Sort numerically
                    .map((event) => (
                        <li key={event} style={{ marginRight: '10px' }}>
                            <button
                                onClick={() => setUserEvent(Number(event))}
                                style={{ padding: '5px 10px' }}
                            >{event}</button>
                        </li>
                    ))}
            </ul>
            <p>{UserEvent}: {eventTranslator[UserEvent]}</p>
            <br />
            <Button
                variant="contained"
                color="secondary"
                onClick={() => gotoNextState()}
                style={{ width: '50%' }}
            >activate {UserEvent}</Button>
            <br />
        </div>
    );
}