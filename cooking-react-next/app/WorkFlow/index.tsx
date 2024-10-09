"use client";

import { Button, Grid, Stack, Box, TextField, IconButton } from "@mui/material";
import { useState, useEffect, useRef, useCallback } from "react";
import { stateTranslator, eventTranslator, stateMachine, stateFunctions, nextEventChooser, executeStateFunction } from './stateMachine';
import { WavRecorder, WavStreamPlayer } from '../wavtools/index.js';
import Switch from '@mui/material/Switch';
import { Toggle } from '../components/toggle/Toggle';
import Button2 from '../components/button/Button';
import SendIcon from '@mui/icons-material/Send';
import MicOffIcon from '@mui/icons-material/MicOff';
// @ts-ignore
import { RealtimeClient } from '@openai/realtime-api-beta';
// @ts-ignore
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
import secret from '../../secret.json';


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


interface RealtimeEvent {
    time: string;
    source: 'client' | 'server';
    count?: number;
    event: { [key: string]: any };
}


export default function WorkFlow(props: WorkFlowProps) {
    const wavRecorderRef = useRef<WavRecorder>(
        new WavRecorder({ sampleRate: 24000 })
    );
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(
        new WavStreamPlayer({ sampleRate: 24000 })
    );
    const clientRef = useRef<RealtimeClient>(
        new RealtimeClient(
            {
                apiKey: secret.OPENAI_KEY,
                dangerouslyAllowAPIKeyInBrowser: true,
            }
        )
    );
    const startTimeRef = useRef<string>(new Date().toISOString());

    const [isConnected, setIsConnected] = useState(false);
    const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
    const [items, setItems] = useState<ItemType[]>([]);
    const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
    const [isRecording, setIsRecording] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);


    /** Bootstrap functions */
    /** Connect to conversation */
    const connectConversation = useCallback(async () => {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        // Set state variables
        startTimeRef.current = new Date().toISOString();
        setIsConnected(true);
        setRealtimeEvents([]);
        setItems(client.conversation.getItems());

        // Connect to microphone
        await wavRecorder.begin();

        // Connect to audio output
        await wavStreamPlayer.connect();

        // Connect to realtime API
        await client.connect();
        client.sendUserMessageContent([
            {
                type: `input_text`,
                text: `For testing purposes, I want you to list 3 car brands. Number each item, e.g. "one (or whatever number you are one): the item name".`
            },
        ]);

        if (client.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
    }, []);

    /* Disconnect and reset conversation state */
    const disconnectConversation = useCallback(async () => {
        setIsConnected(false);
        setRealtimeEvents([]);
        setItems([]);
        setMemoryKv({});

        const client = clientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
    }, []);

    /**
     * In push-to-talk mode, start recording
     * .appendInputAudio() for each sample
     */
    const startRecording = async () => {
        setIsRecording(true);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
            const { trackId, offset } = trackSampleOffset;
            await client.cancelResponse(trackId, offset);
        }
        await wavRecorder.record((data) => client.appendInputAudio(data.mono));
    };

    /**
     * In push-to-talk mode, stop recording
     */
    const stopRecording = async () => {
        setIsRecording(false);
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.pause();
        client.createResponse();
    };

    /**
     * Switch between Manual <> VAD mode for communication
     */
    const changeTurnEndType = async (value: string) => {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        if (value === 'none' && wavRecorder.getStatus() === 'recording') {
            await wavRecorder.pause();
        }
        client.updateSession({
            turn_detection: value === 'none' ? null : { type: 'server_vad' },
        });
        if (value === 'server_vad' && client.isConnected()) {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
        setCanPushToTalk(value === 'none');
    };

    /* Choose next event */
    const gotoNextState = async () => {
        const nextEvent = await nextEventChooser(props.voiceInput, props.videoKnowledgeInput, props.currentState);
        if (nextEvent >= 0) {
            props.setUserEvent(nextEvent);
            props.setCurrentState(stateMachine[props.currentState][nextEvent]);
        } else {
            console.log("No valid events found.");
        }
        let stateFunctionExeRes = executeStateFunction(stateMachine[props.currentState][nextEvent]) as string;
        props.setAgentResponse(stateFunctionExeRes);
    };


    /** Event handlers */
    /**
     * Core RealtimeClient and audio capture setup
     * Set all of our instructions, tools, events and more
     */
    useEffect(() => {
        // Get refs
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const client = clientRef.current;

        // Set instructions
        client.updateSession({
            instructions: `System settings:
            Tool use: enabled.

            Instructions:
            - You are an artificial intelligence agent responsible for helping test realtime voice capabilities
            - Please make sure to respond with a helpful voice via audio
            - Be kind, helpful, and curteous
            - It is okay to ask the user questions
            - Use tools and functions you have available liberally, it is part of the training apparatus
            - Be open to exploration and conversation
            - Remember: this is just for fun and testing!

            Personality:
            - Be upbeat and genuine
            - Try speaking quickly as if excited
            `
        });
        // Set transcription, otherwise we don't get user transcriptions back
        client.updateSession({ input_audio_transcription: { model: 'whisper-1' } });

        // Add tools
        client.addTool(
            {
                name: 'set_memory',
                description: 'Saves important data about the user into memory.',
                parameters: {
                    type: 'object',
                    properties: {
                        key: {
                            type: 'string',
                            description:
                                'The key of the memory value. Always use lowercase and underscores, no other characters.',
                        },
                        value: {
                            type: 'string',
                            description: 'Value can be anything represented as a string',
                        },
                    },
                    required: ['key', 'value'],
                },
            },
            async ({ key, value }: { [key: string]: any }) => {
                setMemoryKv((memoryKv) => {
                    const newKv = { ...memoryKv };
                    newKv[key] = value;
                    return newKv;
                });
                return { ok: true };
            }
        );

        // handle realtime events from client + server for event logging
        client.on('realtime.event', (realtimeEvent: RealtimeEvent) => {
            setRealtimeEvents((realtimeEvents) => {
                const lastEvent = realtimeEvents[realtimeEvents.length - 1];
                if (lastEvent?.event.type === realtimeEvent.event.type) {
                    // if we receive multiple events in a row, aggregate them for display purposes
                    lastEvent.count = (lastEvent.count || 0) + 1;
                    return realtimeEvents.slice(0, -1).concat(lastEvent);
                } else {
                    return realtimeEvents.concat(realtimeEvent);
                }
            });
        });
        client.on('error', (event: any) => console.error(event));
        client.on('conversation.interrupted', async () => {
            const trackSampleOffset = await wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await client.cancelResponse(trackId, offset);
            }
        });
        client.on('conversation.updated', async ({ item, delta }: any) => {
            const items = client.conversation.getItems();
            if (delta?.audio) {
                wavStreamPlayer.add16BitPCM(delta.audio, item.id);
            }
            if (item.status === 'completed' && item.formatted.audio?.length) {
                const wavFile = await WavRecorder.decode(
                    item.formatted.audio,
                    24000,
                    24000
                );
                item.formatted.file = wavFile;
            }
            setItems(items);
        });

        setItems(client.conversation.getItems());

        return () => {
            // cleanup; resets to defaults
            client.reset();
        };
    }, []);


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
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '20px', gap: '16px' }}>
                <Button2
                    label={isConnected ? 'disconnect' : 'connect'}
                    iconPosition={isConnected ? 'end' : 'start'}
                    buttonStyle={isConnected ? 'regular' : 'action'}
                    onClick={isConnected ? disconnectConversation : connectConversation}
                />

                <Toggle
                    defaultValue={false}
                    labels={['manual', 'vad']}
                    values={['none', 'server_vad']}
                    onChange={(_: boolean, value: string) => changeTurnEndType(value)}
                />

                {isConnected && canPushToTalk && (
                    <Button2
                        label={isRecording ? 'release to send' : 'push to talk'}
                        buttonStyle={isRecording ? 'alert' : 'regular'}
                        disabled={!isConnected || !canPushToTalk}
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                    />
                )}
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
                <TextField
                    id="outlined-basic"
                    label="Sentence"
                    variant="outlined"
                    onChange={(e) => props.setVoiceInput(e.target.value)}
                    sx={{ flexGrow: 1, marginRight: 2 }}
                />
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
                    .sort((a, b) => Number(a) - Number(b))
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
                            >
                                {event}: {eventTranslator[Number(event)]}
                            </button>
                        </li>
                    ))}
            </ul>

            <h3>Agent response</h3>
            <p>{props.agentResponse}</p>

            <h3>Memory</h3>
            <div className="content-block kv">
                <div className="content-block-title">Memory</div>
                <div className="content-block-body content-kv">
                    {JSON.stringify(memoryKv, null, 2)}
                </div>
            </div>
        </div>
    );
}