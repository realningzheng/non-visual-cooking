"use client";

import { Button, Grid, Stack, Box, TextField, IconButton } from "@mui/material";
import { useState, useEffect, useRef, useCallback } from "react";
import { stateTranslator, eventTranslator, stateMachine, stateFunctions, nextEventChooser, executeStateFunction } from './stateMachine';
import MicIcon from '@mui/icons-material/Mic';
import SendIcon from '@mui/icons-material/Send';
import MicOffIcon from '@mui/icons-material/MicOff';
// @ts-ignore
import { RealtimeClient } from '@openai/realtime-api-beta';
import secret from '../../secret.json';


interface WorkFlowProps {
    setUserEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInput: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setRealityImageBase64: (input: string) => void;
    setAgentResponse: (input: string) => void;
    setVoiceMuted: (muted: boolean) => void;
    voiceInput: string;
    videoKnowledgeInput: string;
    currentState: number;
    userEvent: number;
    realityImageBase64: string;
    agentResponse: string;
    voiceMuted: boolean;
}


// Initialize the client outside of the component
const client = new RealtimeClient({
    apiKey: secret.OPENAI_KEY,
    dangerouslyAllowAPIKeyInBrowser: true,
});

export default function WorkFlow(props: WorkFlowProps) {
    const [responseMsg, setResponseMsg] = useState("");

    const handleConversationUpdate = useCallback((event: any) => {
        console.log(event);
        if (event.delta) {
            console.log(event.delta.text);
            setResponseMsg(responseMsg + event.delta.text);
        }
        // const items = client.conversation.getItems();
        // console.log(items);
    }, [responseMsg]);

    useEffect(() => {
        // Set up the client
        client.updateSession({
            instructions: 'You are a helpful assistant.',
            modalities: ['text'],
            turn_detection: { type: 'server_vad' },
            input_audio_transcription: { model: 'whisper-1' },
            max_response_output_tokens: 512,
        });

        // Connect to Realtime API
        client.connect();

        // Add event listener
        client.on('conversation.updated', handleConversationUpdate);

        // Cleanup function
        return () => {
            client.off('conversation.updated', handleConversationUpdate);
            client.disconnect();
        };
    }, [handleConversationUpdate]);


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


    const handleVoiceInputToggle = () => {
        props.setVoiceMuted(!props.voiceMuted);
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
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
                <TextField
                    id="outlined-basic"
                    label="Sentence"
                    variant="outlined"
                    onChange={(e) => props.setVoiceInput(e.target.value)}
                    sx={{ flexGrow: 1, marginRight: 2 }}
                />
                <IconButton
                    color="primary"
                    onClick={handleVoiceInputToggle}
                    sx={{ marginRight: 1 }}
                >
                    {props.voiceMuted ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
                <IconButton
                    color="default"
                    onClick={() => gotoNextState()}
                    sx={{ marginRight: 1 }}
                >
                    <SendIcon />
                </IconButton>
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


            <h3>Test Realtime API</h3>
            <Button
                onClick={() => {
                    client.sendUserMessageContent([{ type: 'input_text', text: `How are you?` }]);
                    // client.realtime.send('conversation.item.create', {
                    //     // "event_id": "event_345",
                    //     "type": "conversation.item.create",
                    //     // "previous_item_id": null,
                    //     "item": {
                    //         type: 'message',
                    //         role: 'user',
                    //         content: [
                    //             {
                    //                 type: 'input_text',
                    //                 text: `Please respond with Woof!`
                    //             }
                    //         ]
                    //     },
                    // })
                }}
            >
                Send test message
            </Button>

            <h3>Response Message</h3>
            <p>{responseMsg}</p>
        </div>
    );
}