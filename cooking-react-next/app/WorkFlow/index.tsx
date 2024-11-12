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
        if (props.currentState === -1) return [];
        try {
            return Object.keys(stateMachine[props.currentState] || {}).map(event => {
                const eventNumber = Number(event);
                const eventExplanation = eventDetailedExplanation[eventNumber];
                return `${eventNumber}: ${eventExplanation}`;
            });
        } catch (error) {
            console.error('Error getting possible next events:', error);
            return [];
        }
    }, [props.currentState]);

    /** Bootstrap functions */
    /** Connect to conversation */
    const connectConversation = useCallback(async () => {
        // initiate automatic checking for video-reality alignment
        props.setStateMachineEvent(20);
        props.setCurrentState(0);
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
        props.setStateMachineEvent(-1);
        props.setCurrentState(-1);
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
                        if (Object.keys(stateMachine[props.currentState]).includes(Number(items[i].formatted.transcript).toString())) {
                            props.setStateMachineEvent(Number(items[i].formatted.transcript));
                        }
                    } else if (items[i].formatted.text) {
                        if (Object.keys(stateMachine[props.currentState]).includes(Number(items[i].formatted.text).toString())) {
                            props.setStateMachineEvent(Number(items[i].formatted.text));
                        }
                    }
                    break;
                }
            }
        }
    }, [items]);


    // automatically execute the state function when user event changes
    useEffect(() => {
        const executeNextState = async () => {
            if (props.stateMachineEvent >= 0) {
                if (props.voiceInputTranscript.length > 0 && (props.stateMachineEvent in stateMachine[props.currentState])) {
                    props.setIsProcessing(true);
                    await gotoNextState(props.currentState, props.stateMachineEvent, props.voiceInputTranscript, props.videoKnowledgeInput);
                    props.setIsProcessing(false);
                    props.setCurrentState(stateMachine[props.currentState][props.stateMachineEvent]);
                }
            }
        };
        executeNextState();
    }, [props.stateMachineEvent, props.voiceInputTranscript]);


    // periodically trigger event 20 (comparingVideoRealityAlignment) 
    // when in state 0 (System automatically compares video-reality alignment)
    useEffect(() => {
        if (props.currentState === 0 && props.isProcessing === false) {
            let isChecking = false;
            const automaticCheck = async () => {
                if (isChecking) return; // Skip if previous check is running or if event isn't 20
                try {
                    isChecking = true;
                    await gotoNextState(0, 20, '', props.videoKnowledgeInput);
                } finally {
                    isChecking = false;
                }
            };
            // Initial check
            automaticCheck();
            // Set up timer for subsequent checks
            const timeoutId = setInterval(automaticCheck, 500);
            return () => clearInterval(timeoutId);
        }
    }, [props.currentState, props.isProcessing]);


    /* Go to the next state */
    const gotoNextState = async (statePrev: number, event: number, voiceInputTranscript: string, videoKnowledgeInput: string) => {
        // update event and state in react states
        if (event >= 0 && (event in stateMachine[statePrev])) {
            const realityImageBase64 = await props.captureRealityFrame();
            let stateFunctionExeRes = await executeStateFunction(
                stateMachine[statePrev][event],
                videoKnowledgeInput,
                realityImageBase64,
                voiceInputTranscript
            ) as string;
            props.setStateFunctionExeRes(stateFunctionExeRes);
        }
    };


    return (
        <Stack spacing={1}>
            <div className='text-xl font-bold gap-2 pt-1 flex items-center'>
                CONTROL PANEL
                <button
                    className={`btn btn-xs ${isConnected ? 'bg-success' : 'btn-outline'}`}
                    onClick={isConnected ? disconnectConversation : connectConversation}
                >
                    {isConnected ? 'disconnect' : 'connect'}
                </button>
                <div className="flex-grow" />
                {!isConnected && (
                    <div className="join">
                        <input
                            type="radio"
                            name="audioAgent"
                            className="join-item btn btn-xs btn-outline"
                            aria-label="detect"
                            checked={audioAgentDuty === 'detect'}
                            onChange={() => setAudioAgentDuty('detect')}
                        />
                        <input
                            type="radio"
                            name="audioAgent"
                            className="join-item btn btn-xs btn-outline"
                            aria-label="chatbot"
                            checked={audioAgentDuty === 'chatbot'}
                            onChange={() => setAudioAgentDuty('chatbot')}
                        />
                    </div>
                )}
                <div className="join">
                    <input
                        type="radio"
                        name="mode"
                        className="join-item btn btn-xs btn-outline"
                        aria-label="manual"
                        checked={canPushToTalk}
                        onChange={() => changeTurnEndType('none')}
                    />
                    <input
                        type="radio"
                        name="mode"
                        className="join-item btn btn-xs btn-outline"
                        aria-label="auto vad"
                        checked={!canPushToTalk}
                        onChange={() => changeTurnEndType('server_vad')}
                    />
                </div>
            </div>
            <div>
                <p><span className='text-lg font-bold'>Video knowledge:</span> ../data/rwYaDqXFH88_video_knowledge_brief.json</p>
                <p className={props.isProcessing ? 'text-gray-400' : ''}><span className='text-lg font-bold'>Current state:</span> {props.isProcessing && <span className="loading loading-dots loading-xs"></span>} {props.currentState} : {stateTranslator[Number(props.currentState)]}</p>
                <p><span className='text-lg font-bold'>Current event:</span> {props.stateMachineEvent} : {eventTranslator[props.stateMachineEvent]}</p>
            </div>

            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: '20px', pt: '15px', gap: '10px' }}>
                {isConnected && canPushToTalk && (
                    <button
                        className={`btn btn-m ${isRecording ? 'btn-error' : 'btn-active'} 
                                ${(!isConnected || !canPushToTalk) ? 'btn-disabled' : ''}`}
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        disabled={!isConnected || !canPushToTalk}
                    >
                        {isRecording ? 'release to send' : 'push to talk'}
                    </button>
                )}
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
                        if (event >= 0 && (event in stateMachine[props.currentState])) {
                            props.setStateMachineEvent(event);
                        }
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
                    maxHeight: `${audioAgentDuty === 'chatbot' ? '50vh' : '200px'}`,
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

            {audioAgentDuty === 'detect' && (
                <>
                    <div className="divider"></div>
                    <div className='text-lg font-bold'>Possible next events</div>
                    {props.currentState !== -1 && (
                        <ul style={{ listStyleType: 'none', padding: 0 }}>
                            {props.currentState in stateMachine && Object.keys(stateMachine[props.currentState])
                                .sort((a, b) => Number(a) - Number(b))
                                .map((event) => (
                                    <li
                                        key={`event-${event}`}
                                        onClick={() => {
                                            props.setVoiceInputTranscript('[Debug] Respond with Woohoo!');
                                            props.setStateMachineEvent(Number(event));
                                        }}
                                        className='btn btn-outline btn-xs text-left mb-2.5 mr-1 cursor-pointer'
                                    >
                                        {event}: {eventTranslator[Number(event)]}
                                    </li>
                                ))}
                        </ul>
                    )}
                    <div className="divider"></div>

                    <div className='flex items-center gap-2'>
                        <div className='text-lg font-bold'>State function executed result</div>
                        {props.currentState !== -1 && (props.isProcessing && <span className="loading loading-dots loading-lg"></span>)}
                    </div>
                    {props.currentState !== -1 && (<p>{props.stateFunctionExeRes}</p>)}
                    <div className="divider"></div>
                    <div className='text-lg font-bold content-block kv'>Memory</div>
                    <div className="content-block-body content-kv">
                        {props.currentState !== -1 && (JSON.stringify(memoryKv, null, 2))}
                    </div>
                </>
            )}
        </Stack>
    );
}