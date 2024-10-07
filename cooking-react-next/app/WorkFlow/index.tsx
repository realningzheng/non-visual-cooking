"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { stateTranslator, eventTranslator, stateMachine, stateFunctions, nextEventChooser, executeStateFunction } from './stateMachine';


interface WorkFlowProps {
    setUserEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInput: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setRealityImageBase64: (input: string) => void;
    setAgentResponse: (input: string) => void;
    voiceInput: string;
    videoKnowledgeInput: string;
    currentState: number;
    userEvent: number;
    realityImageBase64: string;
    agentResponse: string;
}


export default function WorkFlow(props: WorkFlowProps) {
    const gotoNextState = async () => {
        const nextEvent = await nextEventChooser(props.voiceInput, props.videoKnowledgeInput, props.currentState);
        if (nextEvent >= 0) {
            props.setUserEvent(nextEvent);
            props.setCurrentState(stateMachine[props.currentState][nextEvent]);
        } else {
            console.log("No valid events found.");
        }
        let stateFunctionExeRes = executeStateFunction(props.currentState) as string;
        props.setAgentResponse(stateFunctionExeRes);
    };

    return (
        <div>
            <h2>Work Flow</h2>
            <h3>Video Knowledge Input</h3>
            <TextField
                id="outlined-basic"
                label="Stream JSON"
                variant="outlined"
                onChange={(e) => props.setVideoKnowledgeInput(e.target.value)}
                style={{ width: '50%' }}
            />

            <h3>Reality Capture</h3>
            <img
                src={props.realityImageBase64}
                alt="Reality Capture"
                style={{ width: '50%', height: 'auto', objectFit: 'contain' }}
            />

            <h3>Voice Command (from user)</h3>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                <TextField
                    id="outlined-basic"
                    label="Sentence"
                    variant="outlined"
                    onChange={(e) => props.setVoiceInput(e.target.value)}
                    sx={{ flexGrow: 1, marginRight: 2 }}
                />
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => gotoNextState()}
                    sx={{ height: '56px' }}
                >
                    activate
                </Button>
            </Box>

            <h3>Current Event</h3>
            <p>{props.userEvent} : {eventTranslator[props.userEvent]}</p>

            <h3>Current State</h3>
            <p>{props.currentState} : {stateTranslator[Number(props.currentState)]}</p>

            <h3>Possible Next Events</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {props.currentState in stateMachine && Object.keys(stateMachine[props.currentState])
                    .sort((a, b) => Number(a) - Number(b)) // Sort numerically
                    .map((event) => (
                        <li key={event} style={{ marginBottom: '10px' }}>
                            <button
                                onClick={() => {
                                    props.setUserEvent(Number(event));
                                    props.setCurrentState(stateMachine[props.currentState][Number(event)]);
                                    let stateFunctionExeRes = executeStateFunction(stateMachine[props.currentState][Number(event)]) as string;
                                    props.setAgentResponse(stateFunctionExeRes);
                                }}
                                style={{ padding: '5px 10px', width: '100%', textAlign: 'left' }}
                            >{event}: {eventTranslator[Number(event)]}</button>
                        </li>
                    ))}
            </ul>

            <h3>Agent response</h3>
            <p>{props.agentResponse}</p>

        </div>
    );
}