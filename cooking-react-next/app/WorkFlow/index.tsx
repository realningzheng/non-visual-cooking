"use client";

import { Stack, Box, TextField, IconButton } from "@mui/material";
import { useState, useEffect, useMemo, useRef } from "react";
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
import DeleteIcon from '@mui/icons-material/Delete';
// @ts-ignore
import { RealtimeClient } from '@openai/realtime-api-beta';
// @ts-ignore
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
import secret from '../../secret.json';
import { FaUser } from "react-icons/fa";
import { RiRobot2Fill } from "react-icons/ri";
import OpenAI from "openai";


interface WorkFlowProps {
    setStateTransitionToggle: (input: boolean) => void;
    captureRealityFrame: () => Promise<string>;
    setStateMachineEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInputTranscript: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setRealityImageBase64: (input: string) => void;
    setStateFunctionExeRes: (input: string) => void;
    setIsProcessing: (input: boolean) => void;
    setTtsSpeed: (input: number) => void;
    stateTransitionToggle: boolean;
    voiceInputTranscript: string;
    videoKnowledgeInput: string;
    currentState: number;
    stateMachineEvent: number;
    realityImageBase64: string;
    stateFunctionExeRes: string;
    isProcessing: boolean;
    ttsSpeed: number;
}


const openaiClient = new OpenAI({ apiKey: secret.OPENAI_KEY, dangerouslyAllowBrowser: true });


export default function WorkFlow(props: WorkFlowProps) {
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const clientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: secret.OPENAI_KEY, dangerouslyAllowAPIKeyInBrowser: true }));
    const startTimeRef = useRef<string>(new Date().toISOString());
    const conversationRef = useRef<HTMLDivElement>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [items, setItems] = useState<ItemType[]>([]);
    const [interactionMemoryKv, setInteractionMemoryKv] = useState<{ [key: string]: any }>({});
    const [autoAgentResponseMemoryKv, setAutoAgentResponseMemoryKv] = useState<{ [key: string]: any }>({});
    const [interactionID, setInteractionID] = useState<number>(0);
    const [autoAgentResponseID, setAutoAgentResponseID] = useState<number>(0);
    const [isRecording, setIsRecording] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [audioAgentDuty, setAudioAgentDuty] = useState<'chatbot' | 'detect'>('detect');
    const possibleNextUserEvents: string[] = useMemo(() => {
        if (props.currentState === -1) return [];
        try {
            return Object.keys(stateMachine[props.currentState] || {}).map(event => {
                const eventNumber = Number(event);
                // exclude those automatic system events, specifically, 10, 11, 12, 20
                if (eventNumber >= 10 && eventNumber <= 20) return '';
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
    const connectConversation = async () => {
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
    };

    /* Disconnect and reset conversation state */
    const disconnectConversation = async () => {
        props.setStateMachineEvent(-1);
        props.setCurrentState(-1);
        setIsConnected(false);
        setItems([]);
        setInteractionMemoryKv({});

        const client = clientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
    };


    /** Delete a conversation item */
    const deleteConversationItem = async (id: string) => {
        const client = clientRef.current;
        client.deleteItem(id);
    };


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
        if (audioAgentDuty === 'chatbot') {
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await client.cancelResponse(trackId, offset);
            }
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
                    ${possibleNextUserEvents.join("\n")}\n

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


    const playTTS = async (text: string, speed: number) => {
        try {
            console.log('[TTS play]', text);
            const wavStreamPlayer = wavStreamPlayerRef.current;
            const mp3Response = await openaiClient.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: text,
                response_format: 'pcm',
                speed: speed,
            });
            const arrayBuffer = await mp3Response.arrayBuffer();
            await wavStreamPlayer.connect();
            await wavStreamPlayer.add16BitPCM(arrayBuffer);
        } catch (error) {
            console.error("Error generating or playing TTS:", error);
        }
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
                setInteractionMemoryKv((interactionMemoryKv) => {
                    const newKv = { ...interactionMemoryKv };
                    newKv[key] = value;
                    return newKv;
                });
                return { ok: true };
            }
        );

        // handle realtime events from client + server for event logging
        client.on('conversation.updated', async ({ item, delta }: any) => {
            const items = client.conversation.getItems();
            // if (delta?.audio) {
            //     wavStreamPlayer.add16BitPCM(delta.audio, item.id);
            // }
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
                    props.setStateTransitionToggle(!props.stateTransitionToggle);
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
    const gotoNextState = async (statePrev: number, event: number, voiceInputTranscript: string, videoKnowledgeInput: string) => {
        if (event >= 0 && (event in stateMachine[statePrev])) {
            if (event === 5) {
                try {
                    const parsed = JSON.parse(props.stateFunctionExeRes);
                    await playTTS(parsed.response, props.ttsSpeed);
                } catch {
                    // do nothing
                }
            } else {
                const realityImageBase64 = await props.captureRealityFrame();
                props.setIsProcessing(true);
                let stateFunctionExeRes = await executeStateFunction(
                    stateMachine[statePrev][event],
                    videoKnowledgeInput,
                    realityImageBase64,
                    voiceInputTranscript,
                    interactionMemoryKv,
                    autoAgentResponseMemoryKv
                );
                props.setIsProcessing(false);

                // Convert object response to string if necessary
                const formattedResponse = typeof stateFunctionExeRes === 'object'
                    ? JSON.stringify(stateFunctionExeRes, null, 2)
                    : String(stateFunctionExeRes);

                if (formattedResponse !== props.stateFunctionExeRes) {
                    props.setStateFunctionExeRes(formattedResponse);
                    // store user input and agent response
                    if (voiceInputTranscript.length > 0) {
                        setInteractionMemoryKv(prevKv => ({
                            ...prevKv,
                            [`voice_input_${interactionID}`]: voiceInputTranscript,
                            [`agent_response_${interactionID}`]: formattedResponse
                        }));
                        setInteractionID(prev => prev + 1);
                    }

                    // store auto agent response
                    if (formattedResponse.length > 0 && formattedResponse.startsWith("<")) {
                        setAutoAgentResponseMemoryKv(prev => ({
                            ...prev,
                            [autoAgentResponseID.toString()]: formattedResponse
                        }));
                        setAutoAgentResponseID(prev => prev + 1);
                    }
                    try {
                        const parsed = JSON.parse(formattedResponse);
                        await playTTS(parsed.response, props.ttsSpeed);
                    } catch {
                        // do nothing
                    }
                }
            }
            return;
        }
    };


    useEffect(() => {
        const executeNextState = async () => {
            if (props.stateMachineEvent >= 0) {
                if (props.voiceInputTranscript.length > 0 && (props.stateMachineEvent in stateMachine[props.currentState])) {
                    await gotoNextState(props.currentState, props.stateMachineEvent, props.voiceInputTranscript, props.videoKnowledgeInput);
                    props.setCurrentState(stateMachine[props.currentState][props.stateMachineEvent]);
                }
            }
        };
        executeNextState();
    }, [props.stateTransitionToggle, props.videoKnowledgeInput]);


    // periodically trigger event 20 (comparingVideoRealityAlignment) 
    // when in state 0 (System automatically compares video-reality alignment)
    // useEffect(() => {
    //     if (props.currentState === 0 && props.isProcessing === false) {
    //         const automaticCheck = async () => {
    //             try {
    //                 if (!isConnected || props.currentState !== 0) return;
    //                 console.log('[automatic check]');
    //                 console.log(props.currentState);
    //                 await gotoNextState(0, 20, '', props.videoKnowledgeInput);
    //                 // Only schedule next check after current one completes
    //                 setTimeout(automaticCheck, 3000);
    //             } catch (error) {
    //                 console.error('Error in automatic check:', error);
    //                 // raise an error
    //                 throw new Error('System automatically detects misalignment');
    //             }
    //         };

    //         // Initial check
    //         automaticCheck();

    //         // Cleanup function
    //         return () => { };
    //     }
    // }, [props.currentState, isConnected]);


    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target?.result as string);
                    props.setVideoKnowledgeInput(JSON.stringify(jsonData));
                    setSelectedFileName(file.name);
                } catch (error) {
                    console.error("Error parsing JSON file:", error);
                    alert("Invalid JSON file");
                }
            };
            reader.readAsText(file);
        }
    };

    // Add a reference to the file input
    const fileInputRef = useRef<HTMLInputElement>(null);

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
                <div className="dropdown dropdown-end mr-2">
                    <label tabIndex={0} className="btn btn-xs btn-ghost bg-gray-0">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </label>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                        <li className="menu-title">Agent Mode</li>
                        <li>
                            <label className="label cursor-pointer">
                                <span className="label-text">Detect</span>
                                <input
                                    type="radio"
                                    name="audioAgent"
                                    checked={audioAgentDuty === 'detect'}
                                    onChange={() => setAudioAgentDuty('detect')}
                                />
                            </label>
                        </li>
                        <li>
                            <label className="label cursor-pointer">
                                <span className="label-text">Chatbot</span>
                                <input
                                    type="radio"
                                    name="audioAgent"
                                    checked={audioAgentDuty === 'chatbot'}
                                    onChange={() => setAudioAgentDuty('chatbot')}
                                />
                            </label>
                        </li>
                        <li className="menu-title">Turn Detection</li>
                        <li>
                            <label className="label cursor-pointer">
                                <span className="label-text">Manual</span>
                                <input
                                    type="radio"
                                    name="mode"
                                    checked={canPushToTalk}
                                    onChange={() => changeTurnEndType('none')}
                                />
                            </label>
                        </li>
                        <li>
                            <label className="label cursor-pointer">
                                <span className="label-text">Auto vad</span>
                                <input
                                    type="radio"
                                    name="mode"
                                    checked={!canPushToTalk}
                                    onChange={() => changeTurnEndType('server_vad')}
                                />
                            </label>
                        </li>
                        <li className="menu-title">TTS Speed</li>
                        <li>
                            <label className="label cursor-pointer">
                                <input
                                    type="range"
                                    className="range range-xs w-full"
                                    min="0.25" max="4" step="0.05"
                                    value={props.ttsSpeed}
                                    onChange={(e) => props.setTtsSpeed(Number(e.target.value))}
                                />
                            </label>
                        </li>
                    </ul>
                </div>
            </div>
            <div>
                <p className="flex items-end gap-2">
                    <span className='text-lg font-bold'>Video knowledge</span>
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="video-knowledge-upload"
                        ref={fileInputRef}
                    />
                    <label
                        htmlFor="video-knowledge-upload"
                        className={`btn btn-xs ${props.videoKnowledgeInput ? 'btn-success' : 'btn-outline'}`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Upload
                    </label>
                    <span>{selectedFileName || ''}</span>
                    {props.videoKnowledgeInput.length > 0 &&
                        <button
                            className="btn btn-xs btn-ghost"
                            onClick={() => {
                                props.setVideoKnowledgeInput('');
                                setSelectedFileName('');
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }}
                        >
                            <DeleteIcon sx={{ fontSize: 16 }} />
                        </button>
                    }
                </p>
                <p><span className='text-lg font-bold'>Current event:</span> {props.stateMachineEvent} : {eventTranslator[props.stateMachineEvent]}</p>
                <p className={props.isProcessing ? 'text-gray-400' : ''}><span className='text-lg font-bold'>Current state:</span> {props.isProcessing && <span className="loading loading-dots loading-xs"></span>} {props.currentState} : {stateTranslator[Number(props.currentState)]}</p>
            </div>
            {/* display the things below only when selected file name is not empty */}
            {selectedFileName && (
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
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                let event = await asyncNextEventChooser(props.voiceInputTranscript, props.currentState);
                                if (event >= 0 && (event in stateMachine[props.currentState])) {
                                    props.setStateMachineEvent(event);
                                    props.setStateTransitionToggle(!props.stateTransitionToggle);
                                }
                            }
                        }}
                    />
                    <IconButton
                        color="inherit"
                        onClick={async () => {
                            let event = await asyncNextEventChooser(props.voiceInputTranscript, props.currentState);
                            if (event >= 0 && (event in stateMachine[props.currentState])) {
                                props.setStateMachineEvent(event);
                                props.setStateTransitionToggle(!props.stateTransitionToggle);
                            }
                        }}
                        sx={{ marginRight: 1 }}
                    >
                        <SendIcon />
                    </IconButton>
                </Box>
            )}

            {selectedFileName && (
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
            )}

            {selectedFileName && audioAgentDuty === 'detect' && (
                <>
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
                    {props.currentState !== -1 && (
                        <p style={{ whiteSpace: 'pre-line' }}>
                            {(() => {
                                try {
                                    const parsed = typeof props.stateFunctionExeRes === 'string'
                                        ? JSON.parse(props.stateFunctionExeRes)
                                        : props.stateFunctionExeRes;
                                    return parsed.response || props.stateFunctionExeRes;
                                } catch {
                                    return props.stateFunctionExeRes;
                                }
                            })()}
                        </p>
                    )}
                    <div className="divider"></div>
                    <div className='text-lg font-bold content-block kv'>Interaction history</div>
                    <div className="content-block-body content-kv">
                        {" { "}
                        {props.currentState !== -1 && Object.entries(interactionMemoryKv).map(([key, value]) => (
                            <div key={key} style={{ marginLeft: '20px' }}>
                                {key}: {String(value).length > 70 ?
                                    `${String(value).substring(0, 40)}...${String(value).slice(-30)}` :
                                    String(value)} ,
                            </div>
                        ))}
                        {" } "}
                    </div>
                    <div className='text-lg font-bold content-block kv'>Agent initiated response memory</div>
                    <div className="content-block-body content-kv">
                        {" { "}
                        {props.currentState !== -1 && Object.entries(autoAgentResponseMemoryKv).map(([key, value]) => (
                            <div key={key} style={{ marginLeft: '20px' }}>
                                {key}: {String(value).length > 70 ?
                                    `${String(value).substring(0, 40)}...${String(value).slice(-30)}` :
                                    String(value)} ,
                            </div>
                        ))}
                        {" } "}
                    </div>
                </>
            )}
        </Stack>
    );
}