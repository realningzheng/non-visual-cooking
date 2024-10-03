"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { stateTranslator, eventTranslator, stateMachine, stateFunctions, nextEventChooser } from './stateMachine';

export default function WorkFlow() {
    const [CurrentState, setCurrentState] = useState(0);
    const [VoiceInput, setVoiceInput] = useState("");
    const [StreamInput, setStreamInput] = useState("");
    const [UserEvent, setUserEvent] = useState(-1);

    const gotoNextState = async() => {
        const nextEvent = await nextEventChooser(VoiceInput, StreamInput, CurrentState);
        if (nextEvent >= 0) {
            setUserEvent(nextEvent);
            setCurrentState(stateMachine[CurrentState][nextEvent]);
        } else {
            console.log("No valid events found.");
        }
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
                {CurrentState in stateMachine && Object.keys(stateMachine[CurrentState])
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