"use client";

import { Stack, Box, TextField, IconButton } from "@mui/material";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    stateTranslator,
    eventTranslator,
    stateMachine,
    stateFunctions,
    asyncNextEventChooser,
    executeStateFunction,
    eventDetailedExplanation
} from './stateMachine';
import { WavRecorder, WavStreamPlayer } from '../wavtools/index.js';
import { XCircle } from 'react-feather';
import SendIcon from '@mui/icons-material/Send';
// @ts-ignore
import { RealtimeClient } from '@openai/realtime-api-beta';
// @ts-ignore
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
import secret from '../../secret.json';
import { FaUser } from "react-icons/fa";
import { RiRobot2Fill } from "react-icons/ri";


interface WorkFlowProps {
    setStateMachineEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInputTranscript: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setRealityImageBase64: (input: string) => void;
    setStateFunctionExeRes: (input: string) => void;
    setIsProcessing: (input: boolean) => void;
    voiceInputTranscript: string;
    videoKnowledgeInput: string;
    currentState: number;
    stateMachineEvent: number;
    realityImageBase64: string;
    stateFunctionExeRes: string;
    isProcessing: boolean;
    captureRealityFrame: () => Promise<string>;
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
    const [audioAgentDuty, setAudioAgentDuty] = useState<'chatbot' | 'detect'>('detect');
    const possibleNextEvents: string[] = useMemo(() => {
        return Object.keys(stateMachine[props.currentState]).map(event => {
            const eventNumber = Number(event);
            const eventExplanation = eventDetailedExplanation[eventNumber];
            return `${eventNumber}: ${eventExplanation}`;
        });
    }, [props.currentState]);

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
                    text: `Please decide the sentence I just said falls under which type of the following categories:\n\n
                    ${possibleNextEvents.join("\n")}\n

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
    const gotoNextState = async (event: number) => {
        console.log(`received event: ${event}, ready to go to the next state`);
        props.setIsProcessing(true);
        // update event and state in react states
        if (event >= 0) {
            props.setStateMachineEvent(event);
            props.setCurrentState(stateMachine[props.currentState][event]);
        } else {
            console.log("No valid events found.");
        }
        // execute the corresponding state function
        const realityImageBase64 = await props.captureRealityFrame();
        let stateFunctionExeRes = await executeStateFunction(stateMachine[props.currentState][event], props.videoKnowledgeInput, realityImageBase64, props.voiceInputTranscript) as string;
        props.setStateFunctionExeRes(stateFunctionExeRes);
        props.setIsProcessing(false);
    };


    /** Event handlers */
    /** Core RealtimeClient and audio capture setup */
    useEffect(() => {
        // Get refs
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const client = clientRef.current;
        console.log("client", client);
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

    // periodically trigger event 20 (comparingVideoRealityAlignment) 
        // when in state 0 (System automatically compares video-reality alignment)
    useEffect(() => {
        if (props.currentState === 0) {
            // Define the function to be called periodically
            const automaticCheck = async () => {
                console.log("checking for automatic events...");
                props.setStateMachineEvent(20);
            };
            const intervalId = setInterval(automaticCheck, 5000); // Calls every 5 seconds
            return () => clearInterval(intervalId);
        }
    }, [props.currentState]);
        

    return (
        <Stack spacing={2}>
            <div className='text-2xl font-bold'>Control Panel</div>
            <div>
                <p><span className='text-lg font-bold'>Video knowledge:</span> ../data/rwYaDqXFH88_video_knowledge_brief.json</p>
                <p><span className='text-lg font-bold'>Current state:</span> {props.currentState} : {stateTranslator[Number(props.currentState)]}</p>
                <p><span className='text-lg font-bold'>Current event:</span> {props.stateMachineEvent} : {eventTranslator[props.stateMachineEvent]}</p>
            </div>

            <div>
                <div className='text-lg font-bold mb-2'>Voice Command</div>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', gap: '16px' }}>
                    <button
                        className={`px-4 py-2 rounded ${isConnected ? 'bg-gray-200' : 'bg-black text-white'}`}
                        onClick={isConnected ? disconnectConversation : connectConversation}
                    >
                        {isConnected ? 'disconnect' : 'connect'}
                    </button>

                    <div className="flex">
                        <button
                            className={`px-4 py-2 rounded ${canPushToTalk ? 'bg-black text-white' : 'bg-gray-200'}`}
                            onClick={() => changeTurnEndType('none')}
                        >
                            manual
                        </button>
                        <button
                            className={`px-4 py-2 rounded ${!canPushToTalk ? 'bg-black text-white' : 'bg-gray-200'}`}
                            onClick={() => changeTurnEndType('server_vad')}
                        >
                            vad
                        </button>
                    </div>

                    {isConnected && canPushToTalk && (
                        <button
                            className={`px-4 py-2 rounded ${isRecording ? 'bg-red-500' : 'bg-gray-200'} 
                                ${(!isConnected || !canPushToTalk) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            disabled={!isConnected || !canPushToTalk}
                        >
                            {isRecording ? 'release to send' : 'push to talk'}
                        </button>
                    )}

                    <div style={{ flexGrow: 1 }} />

                    {!isConnected && (
                        <div className="flex gap-0">
                            <button
                                className={`px-4 py-2 rounded ${audioAgentDuty === 'chatbot' ? 'bg-black text-white' : 'bg-gray-200'}`}
                                onClick={() => setAudioAgentDuty('chatbot')}
                            >
                                chatbot
                            </button>
                            <button
                                className={`px-4 py-2 rounded ${audioAgentDuty === 'detect' ? 'bg-black text-white' : 'bg-gray-200'}`}
                                onClick={() => setAudioAgentDuty('detect')}
                            >
                                detect
                            </button>
                        </div>
                    )}
                </Box>
            </div>

            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '20px' }}>
                <input
                    type="text"
                    placeholder="Latest user command"
                    className="input input-bordered w-full"
                    onChange={(e) => props.setVoiceInputTranscript(e.target.value)}
                    value={props.voiceInputTranscript}
                />
                <IconButton
                    color="inherit"
                    onClick={async () => {
                        let event = await asyncNextEventChooser(props.voiceInputTranscript, props.videoKnowledgeInput, props.currentState);
                        props.setStateMachineEvent(event);
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
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                                <FaUser /> <h5 style={{ marginLeft: '10px' }}>
                                                    {conversationItem.formatted.transcript ||
                                                        (conversationItem.formatted.audio?.length
                                                            ? '(awaiting transcript)'
                                                            : conversationItem.formatted.text ||
                                                            '(item sent)')
                                                    }
                                                </h5>
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

                                        </div>
                                    )
                                }
                                {!conversationItem.formatted.tool && audioAgentDuty === 'chatbot' &&
                                    conversationItem.role === 'assistant' && (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                                                <RiRobot2Fill /> <h5 style={{ marginLeft: '10px' }}>
                                                    {conversationItem.formatted.transcript ||
                                                        conversationItem.formatted.text ||
                                                        '(truncated)'
                                                    }
                                                </h5>
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
                                        </div>
                                    )
                                }
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="divider"></div>

            <div className='text-lg font-bold'>Possible Next Events</div>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
                {props.currentState in stateMachine && Object.keys(stateMachine[props.currentState])
                    .sort((a, b) => Number(a) - Number(b))
                    .map((event) => (
                        <li
                            key={`event-${event}`}
                            onClick={() => props.setStateMachineEvent(Number(event))}
                            className='btn btn-outline btn-xs text-left mb-2.5 mr-1 cursor-pointer'
                        >
                            {event}: {eventTranslator[Number(event)]}
                        </li>
                    ))}
            </ul>
            <div className="divider"></div>

            <div className='flex items-center gap-2'>
                <div className='text-lg font-bold'>State function executed result</div>
                {props.isProcessing && <span className="loading loading-dots loading-lg"></span>}
            </div>
            <p>{props.stateFunctionExeRes}</p>
            <div className="divider"></div>

            <div className='text-lg font-bold content-block kv'>Memory</div>
            <div className="content-block-body content-kv">
                {JSON.stringify(memoryKv, null, 2)}
            </div>
        </Stack>
    );
}