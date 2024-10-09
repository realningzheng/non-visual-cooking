"use client";

import { Button, Stack, Box, TextField, IconButton } from "@mui/material";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { stateTranslator, eventTranslator, stateMachine, stateFunctions, asyncNextEventChooser, executeStateFunction } from './stateMachine';
import { WavRecorder, WavStreamPlayer } from '../wavtools/index.js';
import { X, Codepen, XCircle, Edit, Zap, ArrowUp, ArrowDown, Mic } from 'react-feather';
import { Toggle } from '../components/toggle/Toggle';
import Button2 from '../components/button/Button';
import SendIcon from '@mui/icons-material/Send';
// @ts-ignore
import { RealtimeClient } from '@openai/realtime-api-beta';
// @ts-ignore
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
import secret from '../../secret.json';


interface WorkFlowProps {
    setStateMachineEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInputTranscript: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setRealityImageBase64: (input: string) => void;
    setStateFunctionExeRes: (input: string) => void;
    voiceInputTranscript: string;
    videoKnowledgeInput: string;
    currentState: number;
    stateMachineEvent: number;
    realityImageBase64: string;
    stateFunctionExeRes: string;
}


export default function WorkFlow(props: WorkFlowProps) {
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const clientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: secret.OPENAI_KEY, dangerouslyAllowAPIKeyInBrowser: true }));
    const startTimeRef = useRef<string>(new Date().toISOString());
    const conversationRef = useRef<HTMLDivElement>(null);

    const [isConnected, setIsConnected] = useState(false);
    const [items, setItems] = useState<ItemType[]>([]);
    const [memoryKv, setMemoryKv] = useState<{ [key: string]: any }>({});
    const [isRecording, setIsRecording] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [audioAgentDuty, setAudioAgentDuty] = useState<'chatbot' | 'detect'>('chatbot');
    const possibleNextEventsObj = useMemo(() => stateMachine[props.currentState], [props.currentState]);
    const possibleNextEvents: string[] = useMemo(() =>
        Object.keys(possibleNextEventsObj).map(event => {
            const eventNumber = Number(event); // Convert event key to number
            const eventExplanation = eventTranslator[eventNumber]; // Get explanation from eventTranslator
            return `${eventNumber}: ${eventExplanation}`;
        }), [possibleNextEventsObj]
    );

    /** Bootstrap functions */
    /** Connect to conversation */
    const connectConversation = useCallback(async () => {
        const client = clientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        // Set state variables
        startTimeRef.current = new Date().toISOString();
        setIsConnected(true);
        setItems(client.conversation.getItems());

        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await client.connect();
        if (client.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => client.appendInputAudio(data.mono));
        }
    }, []);

    /* Disconnect and reset conversation state */
    const disconnectConversation = useCallback(async () => {
        setIsConnected(false);
        setItems([]);
        setMemoryKv({});

        const client = clientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
    }, []);


    /** Delete a conversation item */
    const deleteConversationItem = useCallback(async (id: string) => {
        const client = clientRef.current;
        client.deleteItem(id);
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
        if (audioAgentDuty === 'detect') {
            // @TODO: should be a better way to append this message at the beginning of the conversation
            client.sendUserMessageContent([
                {
                    type: `input_text`,
                    text: `The content I just mentioned falls under which type of the following categories:\n\n
                    ${possibleNextEvents.join("\n")}\n
                    -1: Not related to cooking task at all\n
                    Please reply ONLY the index of the most appropriate category.`
                }
            ]);
        } else if (audioAgentDuty === 'chatbot') {
            client.createResponse();
        } else {
            console.error("Invalid audio agent duty");
        }
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


    /* Go to the next state */
    const gotoNextState = async (nextEvent: number) => {
        // update event and state in react states
        if (nextEvent >= 0) {
            props.setStateMachineEvent(nextEvent);
            props.setCurrentState(stateMachine[props.currentState][nextEvent]);
        } else {
            console.log("No valid events found.");
        }
        // execute the corresponding state function
        let stateFunctionExeRes = await executeStateFunction(stateMachine[props.currentState][nextEvent]) as string;
        props.setStateFunctionExeRes(stateFunctionExeRes);
    };


    /** Event handlers */
    /** Core RealtimeClient and audio capture setup */
    useEffect(() => {
        // Get refs
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const client = clientRef.current;

        // Set instructions
        client.updateSession({
            instructions: `System settings:
            Tool use: enabled.

            Instructions:
            - You are an artificial intelligence agent responsible for helping low-vision users cook in the kitchen.
            - The user has provided a video knowledge in JSON format which contains multimodal information on how to correctly cook in the kitchen.
            - Please help the user by answering their questions and guiding them through the cooking process based on the video knowledge.
            - Please make sure to respond with a helpful voice via audio
            - Be kind, helpful, and courteous
            - It is okay to ask the user questions
            - Use tools and functions you have available liberally, it is part of the training apparatus
            - Be open to exploration and conversation

            Personality:
            - Be upbeat and genuine
            - Try speaking quickly as if excited

            Video Knowledge:
            ${props.videoKnowledgeInput}
            `
        });

        // Set transcription, otherwise we don't get user transcriptions back
        client.updateSession({
            input_audio_transcription: { model: 'whisper-1' },
            modalities: ['text', 'audio']
        });

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
        client.on('conversation.interrupted', async () => {
            const trackSampleOffset = await wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await client.cancelResponse(trackId, offset);
            }
        });
        client.on('error', (event: any) => console.error(event));

        setItems(client.conversation.getItems());

        return () => {
            // cleanup; resets to defaults
            client.reset();
        };
    }, []);


    // Handle user transcript update
    useEffect(() => {
        // scroll the conversation panel to the bottom
        if (conversationRef.current) {
            conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
        }
        if (items.length > 0) {
            // read through items in reverse to find the latest user transcript and agent response
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].role === 'user' && items[i].formatted.transcript) {
                    props.setVoiceInputTranscript(items[i].formatted.transcript || '');
                    break;
                }
            }
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].role === 'assistant') {
                    // set user event to the non-null value among transcript and text
                    if (items[i].formatted.transcript) {
                        props.setStateMachineEvent(Number(items[i].formatted.transcript));
                    } else if (items[i].formatted.text) {
                        props.setStateMachineEvent(Number(items[i].formatted.text));
                    } else {
                        props.setStateMachineEvent(-1);
                    }
                    break;
                }
            }
        }
    }, [items]);


    // automatically execute the state function when user event changes
    useEffect(() => {
        if (props.stateMachineEvent >= 0) {
            gotoNextState(props.stateMachineEvent);
        }
    }, [props.stateMachineEvent]);

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

            <h3>Voice Command</h3>
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

                <div style={{ flexGrow: 1 }} />

                {!isConnected && <Toggle
                    defaultValue={false}
                    labels={['chatbot', 'detect']}
                    values={['chatbot', 'detect']}
                    onChange={(_: boolean, value: string) => setAudioAgentDuty(value as 'chatbot' | 'detect')}
                />}
            </Box>

            <h4>Conversation history</h4>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
                <TextField
                    id="outlined-basic"
                    label="Latest user command"
                    variant="outlined"
                    onChange={(e) => props.setVoiceInputTranscript(e.target.value)}
                    value={props.voiceInputTranscript}
                    sx={{ flexGrow: 1, '& .MuiOutlinedInput-root': { '& fieldset': { borderColor: 'black', borderWidth: '2px', borderRadius: '10px' } } }}
                />
                <IconButton
                    color="inherit"
                    onClick={async () => {
                        let nextEvent = await asyncNextEventChooser(props.voiceInputTranscript, props.videoKnowledgeInput, props.currentState);
                        gotoNextState(nextEvent);
                    }}
                    sx={{ marginRight: 1 }}
                >
                    <SendIcon />
                </IconButton>
            </Box>

            <div
                className="content-block-body"
                data-conversation-content
                ref={conversationRef}
                style={{
                    maxHeight: '200px',
                    overflowY: 'auto',
                    border: '1px solid #ccc',
                    borderRadius: '5px',
                    padding: '10px',
                    marginBottom: '20px'
                }}
            >
                {!items.length && !isConnected && `awaiting connection...`}
                {items.map((conversationItem, i) => {
                    return (
                        <div className="conversation-item" key={conversationItem.id}>
                            <div className={`speaker-content`}>
                                {/* tool response */}
                                {conversationItem.type === 'function_call_output' && (
                                    <div>{conversationItem.formatted.output}</div>
                                )}
                                {/* tool call */}
                                {!!conversationItem.formatted.tool && (
                                    <div>
                                        {conversationItem.formatted.tool.name}(
                                        {conversationItem.formatted.tool.arguments})
                                    </div>
                                )}

                                {/* Transcript from the user */}
                                {!conversationItem.formatted.tool &&
                                    conversationItem.role === 'user' && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <Mic /> <h5 style={{ marginLeft: '10px' }}>User transcript:</h5>
                                                <div style={{ flexGrow: 1 }} />
                                                <div
                                                    className="close"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() =>
                                                        deleteConversationItem(conversationItem.id)
                                                    }
                                                >
                                                    < XCircle />
                                                </div>
                                            </div>
                                            {conversationItem.formatted.transcript ||
                                                (conversationItem.formatted.audio?.length
                                                    ? '(awaiting transcript)'
                                                    : conversationItem.formatted.text ||
                                                    '(item sent)')
                                            }
                                        </div>
                                    )
                                }
                                {!conversationItem.formatted.tool &&
                                    conversationItem.role === 'assistant' && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <Codepen /> <h5 style={{ marginLeft: '10px' }}>Agent response:</h5>
                                                {/* div flexgrow */}
                                                <div style={{ flexGrow: 1 }} />
                                                <div
                                                    className="close"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() =>
                                                        deleteConversationItem(conversationItem.id)
                                                    }
                                                >
                                                    < XCircle />
                                                </div>
                                            </div>
                                            {conversationItem.formatted.transcript ||
                                                conversationItem.formatted.text ||
                                                '(truncated)'
                                            }
                                        </div>
                                    )
                                }
                                {/* {conversationItem.formatted.file && (
                                    <audio
                                        src={conversationItem.formatted.file.url}
                                        controls
                                    />
                                )} */}
                            </div>
                        </div>
                    );
                })}
            </div>

            <h3>Current State</h3>
            <p>{props.currentState} : {stateTranslator[Number(props.currentState)]}</p>

            <h3>Current Event</h3>
            <p>{props.stateMachineEvent} : {eventTranslator[props.stateMachineEvent]}</p>

            <h3>State function executed result</h3>
            <p>{props.stateFunctionExeRes}</p>

            <h3>Possible Next Events</h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {props.currentState in stateMachine && Object.keys(stateMachine[props.currentState])
                    .sort((a, b) => Number(a) - Number(b))
                    .map((event) => (
                        <li key={event} style={{ marginBottom: '10px' }}>
                            <button
                                onClick={async () => {
                                    props.setStateMachineEvent(Number(event));
                                    props.setCurrentState(stateMachine[props.currentState][Number(event)]);
                                    let stateFunctionExeRes = await executeStateFunction(stateMachine[props.currentState][Number(event)]) as string;
                                    props.setStateFunctionExeRes(stateFunctionExeRes);
                                }}
                                style={{ padding: '5px 10px', width: '100%', textAlign: 'left' }}
                            >
                                {event}: {eventTranslator[Number(event)]}
                            </button>
                        </li>
                    ))}
            </ul>

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