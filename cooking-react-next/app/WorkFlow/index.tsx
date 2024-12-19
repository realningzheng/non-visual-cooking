"use client";

import { Stack, Box, TextField, IconButton } from "@mui/material";
import { useState, useEffect, useMemo, useRef } from "react";
import {
    stateTranslator,
    eventTranslator,
    stateMachine,
    stateFunctions,
    getPromptForPossibleNextEvents,
    executeStateFunction,
    eventDetailedExplanation
} from './stateMachine';
// import { WavRecorder, WavStreamPlayer } from '../wavtools/index.js';
// import { XCircle } from 'react-feather';
// import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
// @ts-ignore
// import { RealtimeClient } from '@openai/realtime-api-beta';
// // @ts-ignore
// import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
// import credential from '../../secret.json';
// import { FaUser } from "react-icons/fa";
// import { RiRobot2Fill } from "react-icons/ri";
// import OpenAI from "openai";
import { repeatPreviousInteraction, getPlaySegmentedVideoFlag } from "./eventStateFunctions";
import { useEventDetectionContext } from "../contexts/EventDetectionContext";
import { useMultimodalStateContext } from "../contexts/MultimodalStateContext";
import { IoSend } from "react-icons/io5";


// const openaiClient = new OpenAI({ apiKey: credential.OPENAI_KEY, dangerouslyAllowBrowser: true });


interface WorkFlowProps {
    setStateTransitionToggle: (input: boolean) => void;
    setStateMachineEvent: (event: number) => void;
    setCurrentState: (state: number) => void;
    setVoiceInputTranscript: (input: string) => void;
    setVideoKnowledgeInput: (input: string) => void;
    setStateFunctionExeRes: (input: string) => void;
    setIsProcessing: (input: boolean) => void;
    setTtsSpeed: (input: number) => void;
    setSegmentedVideoPlaying: (input: boolean) => void;
    setReplaySignal: (input: boolean) => void;
    setRealityImageBase64: (input: string) => void;
    stateTransitionToggle: boolean;
    voiceInputTranscript: string;
    videoKnowledgeInput: string;
    currentState: number;
    stateMachineEvent: number;
    stateFunctionExeRes: string;
    isProcessing: boolean;
    ttsSpeed: number;
    replaySignal: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
}

// Update the interface for the interaction memory items
interface InteractionMemoryItem {
    index: number;
    user_query?: string;
    agent_response?: string;
    video_segment_index?: number[];
    memorized_item_key?: string;
    memorized_item_value?: string;
}

// Update the interface for auto agent response items
interface AutoAgentResponseItem {
    index: number;
    response: string;
}


export default function WorkFlow(props: WorkFlowProps) {
    const {
        client: eventClient,
        content: eventContent,
        turnComplete: eventTurnComplete
    } = useEventDetectionContext();
    const {
        client: multimodalClient,
        content: multimodalContent,
        turnComplete: multimodalTurnComplete
    } = useMultimodalStateContext();

    // Track previous turnComplete value
    const prevEventTurnComplete = useRef(eventTurnComplete);
    const prevMultimodalTurnComplete = useRef(multimodalTurnComplete);

    // const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    // const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    // const clientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: credential.OPENAI_KEY, dangerouslyAllowAPIKeyInBrowser: true }));
    // const startTimeRef = useRef<string>(new Date().toISOString());
    // const conversationRef = useRef<HTMLDivElement>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    // const [isConnected, setIsConnected] = useState(false)
    // const [items, setItems] = useState<ItemType[]>([]);
    const [interactionMemoryKv, setInteractionMemoryKv] = useState<InteractionMemoryItem[]>([]);
    const [autoAgentResponseMemoryKv, setAutoAgentResponseMemoryKv] = useState<AutoAgentResponseItem[]>([]);
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


    const [clientEventResponse, setClientEventResponse] = useState<string>('');
    const [clientMultimodalResponse, setClientMultimodalResponse] = useState<string>('');

    // const playTTS = async (text: string, speed: number) => {
    //     console.log('[TTS play not implemented!]', text);
    //     try {
    //         console.log('[TTS play]', text);
    //         const wavStreamPlayer = wavStreamPlayerRef.current;
    //         const mp3Response = await openaiClient.audio.speech.create({
    //             model: "tts-1",
    //             voice: "alloy",
    //             input: text,
    //             response_format: 'pcm',
    //             speed: speed,
    //         });
    //         const arrayBuffer = await mp3Response.arrayBuffer();
    //         await wavStreamPlayer.connect();
    //         await wavStreamPlayer.add16BitPCM(arrayBuffer);
    //     } catch (error) {
    //         console.error("Error generating or playing TTS:", error);
    //     }
    // };


    /** Event handlers */
    /** Core RealtimeClient and audio capture setup */
    // useEffect(() => {
    //     // Get refs
    //     const wavStreamPlayer = wavStreamPlayerRef.current;
    //     const client = clientRef.current;
    //     // Set instructions
    //     client.updateSession({
    //         instructions: `System settings:
    //         Tool use: enabled.
    //         `
    //     });

    //     // Set transcription, otherwise we don't get user transcriptions back
    //     client.updateSession({
    //         input_audio_transcription: { model: 'whisper-1' },
    //         modalities: ['text', 'audio']
    //     });

    //     // Add tools
    //     client.addTool(
    //         {
    //             name: 'set_memory',
    //             description: 'Saves important data about the user into memory.',
    //             parameters: {
    //                 type: 'object',
    //                 properties: {
    //                     key: {
    //                         type: 'string',
    //                         description:
    //                             'The key of the memory value. Always use lowercase and underscores, no other characters.',
    //                     },
    //                     value: {
    //                         type: 'string',
    //                         description: 'Value can be anything represented as a string',
    //                     },
    //                 },
    //                 required: ['key', 'value'],
    //             },
    //         },
    //         async ({ key, value }: { [key: string]: any }) => {
    //             setInteractionMemoryKv(prevList => [
    //                 ...prevList,
    //                 {
    //                     index: interactionID,
    //                     memorized_item_key: key,
    //                     memorized_item_value: value
    //                 }
    //             ]);
    //             setInteractionID(prev => prev + 1);
    //             return { ok: true };
    //         }
    //     );

    //     // handle realtime events from client + server for event logging
    //     client.on('conversation.updated', async ({ item, delta }: any) => {
    //         const items = client.conversation.getItems();
    //         // if (delta?.audio) {
    //         //     wavStreamPlayer.add16BitPCM(delta.audio, item.id);
    //         // }
    //         if (item.status === 'completed' && item.formatted.audio?.length) {
    //             const wavFile = await WavRecorder.decode(
    //                 item.formatted.audio,
    //                 24000,
    //                 24000
    //             );
    //             item.formatted.file = wavFile;
    //         }
    //         setItems(items);
    //     });
    //     client.on('conversation.interrupted', async () => {
    //         const trackSampleOffset = await wavStreamPlayer.interrupt();
    //         if (trackSampleOffset?.trackId) {
    //             const { trackId, offset } = trackSampleOffset;
    //             await client.cancelResponse(trackId, offset);
    //         }
    //     });
    //     client.on('error', (event: any) => console.error(event));

    //     setItems(client.conversation.getItems());

    //     return () => {
    //         // cleanup; resets to defaults
    //         client.reset();
    //     };
    // }, []);


    // Handle user transcript update
    // useEffect(() => {
    //     // scroll the conversation panel to the bottom
    //     if (conversationRef.current) {
    //         conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    //     }
    //     if (items.length > 0) {
    //         // read through items in reverse to find the latest user transcript and agent response
    //         for (let i = items.length - 1; i >= 0; i--) {
    //             if (items[i].role === 'user' && items[i].formatted.transcript) {
    //                 props.setVoiceInputTranscript(items[i].formatted.transcript || '');
    //                 props.setStateTransitionToggle(!props.stateTransitionToggle);
    //                 break;
    //             }
    //         }
    //         for (let i = items.length - 1; i >= 0; i--) {
    //             if (items[i].role === 'assistant') {
    //                 // set user event to the non-null value among transcript and text
    //                 if (items[i].formatted.transcript) {
    //                     if (Object.keys(stateMachine[props.currentState]).includes(Number(items[i].formatted.transcript).toString())) {
    //                         props.setStateMachineEvent(Number(items[i].formatted.transcript));
    //                     }
    //                 } else if (items[i].formatted.text) {
    //                     if (Object.keys(stateMachine[props.currentState]).includes(Number(items[i].formatted.text).toString())) {
    //                         props.setStateMachineEvent(Number(items[i].formatted.text));
    //                     }
    //                 }
    //                 break;
    //             }
    //         }
    //     }
    // }, [items]);


    /** Handle state transition */
    // const gotoNextState = async (
    //     statePrev: number,
    //     event: number,
    //     voiceInputTranscript: string,
    //     videoKnowledgeInput: string
    // ) => {
    //     if (event >= 0 && (event in stateMachine[statePrev])) {
    //         if (event === 5) {              // handle replay previous interaction 
    //             let retrievedResponse = await repeatPreviousInteraction(
    //                 voiceInputTranscript,
    //                 interactionMemoryKv
    //             );
    //             let retrievedIndex = Number(retrievedResponse.response);
    //             let retrievedInfo = interactionMemoryKv[retrievedIndex];
    //             let agentResponse = retrievedInfo.agent_response;
    //             let videoSegmentIndex = retrievedInfo.video_segment_index;
    //             // if (agentResponse) {
    //             //     await playTTS(agentResponse, props.ttsSpeed);
    //             // }
    //             props.setStateFunctionExeRes(JSON.stringify({ "response": agentResponse, "video_segment_index": videoSegmentIndex }));
    //         } else if (event === 6) {       // handle replay segmented video
    //             let response = await getPlaySegmentedVideoFlag(voiceInputTranscript);
    //             if (response.response === 0) {
    //                 props.setSegmentedVideoPlaying(false);
    //             } else if (response.response === 1) {
    //                 props.setSegmentedVideoPlaying(true);
    //             } else if (response.response === 2) {
    //                 props.setSegmentedVideoPlaying(true);
    //                 props.setReplaySignal(!props.replaySignal);
    //             }
    //         } else {
    //             props.setSegmentedVideoPlaying(false);
    //             props.setIsProcessing(true);
    //             let realityImageBase64 = '';
    //             const canvas = props.canvasRef.current;
    //             const video = props.videoRef.current;
    //             if (canvas && video) {
    //                 canvas.width = video.videoWidth;
    //                 canvas.height = video.videoHeight;
    //                 canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    //                 // save the image to base64 string
    //                 const base64data = canvas.toDataURL('image/png');
    //                 realityImageBase64 = base64data;
    //             }
    //             props.setRealityImageBase64(realityImageBase64);
    //             let stateFunctionExeRes = await executeStateFunction(
    //                 stateMachine[statePrev][event],
    //                 videoKnowledgeInput,
    //                 realityImageBase64,
    //                 voiceInputTranscript,
    //                 interactionMemoryKv,
    //                 autoAgentResponseMemoryKv
    //             );
    //             props.setIsProcessing(false);

    //             // Convert object response to string if necessary
    //             const stringifiedResponse = typeof stateFunctionExeRes === 'object'
    //                 ? JSON.stringify(stateFunctionExeRes, null, 2)
    //                 : String(stateFunctionExeRes);

    //             if (stringifiedResponse !== props.stateFunctionExeRes) {
    //                 props.setStateFunctionExeRes(stringifiedResponse);
    //                 // store user input and agent response
    //                 if (voiceInputTranscript.length > 0) {
    //                     if (typeof stateFunctionExeRes === 'object') {
    //                         setInteractionMemoryKv(prevList => [
    //                             ...prevList,
    //                             {
    //                                 index: interactionID,
    //                                 user_query: voiceInputTranscript,
    //                                 agent_response: stateFunctionExeRes.response,
    //                                 video_segment_index: stateFunctionExeRes.video_segment_index
    //                             }
    //                         ]);
    //                         setInteractionID(prev => prev + 1);
    //                     }

    //                     // store auto agent response
    //                     if (typeof stateFunctionExeRes !== 'object') {
    //                         setAutoAgentResponseMemoryKv(prevList => [
    //                             ...prevList,
    //                             {
    //                                 index: autoAgentResponseID,
    //                                 response: stringifiedResponse
    //                             }
    //                         ]);
    //                         setAutoAgentResponseID(prev => prev + 1);
    //                     }

    //                     // // play the natural language response from the agent
    //                     // if (typeof stateFunctionExeRes === 'object') {
    //                     //     await playTTS(String(stateFunctionExeRes.response), props.ttsSpeed);
    //                     // } else {
    //                     //     await playTTS(stringifiedResponse, props.ttsSpeed);
    //                     // }
    //                 }
    //             }
    //             return;
    //         }
    //     };
    // }


    const handleSubmit = (voiceInput: string, currentState: number): void => {
        const nextEventPrompt = getPromptForPossibleNextEvents(currentState);
        eventClient.send([{ text: '<USER REQUEST>: \n' + voiceInput + nextEventPrompt }]);
    }


    /** Handle state transition */
    useEffect(() => {
        const executeNextState = async () => {
            if (props.stateMachineEvent >= 0) {
                if (props.voiceInputTranscript.length > 0 && (props.stateMachineEvent in stateMachine[props.currentState])) {
                    // await gotoNextState(props.currentState, props.stateMachineEvent, props.voiceInputTranscript, props.videoKnowledgeInput);
                    props.setCurrentState(stateMachine[props.currentState][props.stateMachineEvent]);
                }
            }
        };
        executeNextState();
    }, [props.stateTransitionToggle, props.videoKnowledgeInput]);


    /** Listen to event detection content stream */
    useEffect(() => {
        // When turnComplete switches from true to false, reset the state
        if (!eventTurnComplete && prevEventTurnComplete.current) {
            setClientEventResponse('');
        }

        // Only process content when we're in the middle of a turn
        if (eventContent.length > 0 && !eventTurnComplete) {
            setClientEventResponse(prev => {
                // Check if content is already at the end of prev
                if (!prev.endsWith(eventContent)) {
                    return prev + eventContent;
                }
                return prev;
            });
        }

        // Update the ref for next render
        prevEventTurnComplete.current = eventTurnComplete;
    }, [eventContent, eventTurnComplete]);


    /** Handle event and state change c*/
    useEffect(() => {
        if (!clientEventResponse) return;
        try {
            // Try parsing as JSON first in case it's a list
            const parsed = JSON.parse(clientEventResponse);

            if (Array.isArray(parsed)) {
                // If it's an array, take the first number
                if (parsed.length > 0) {
                    const number = Number(parsed[0]);
                    if (!isNaN(number)) {
                        props.setStateMachineEvent(number);
                        props.setStateTransitionToggle(!props.stateTransitionToggle);
                    }
                }
            } else {
                // If it's a single value, convert directly to number
                const number = Number(parsed);
                if (!isNaN(number)) {
                    props.setStateMachineEvent(number);
                    props.setStateTransitionToggle(!props.stateTransitionToggle);
                }
            }
        } catch (e) {
            // If JSON parsing fails, try converting directly to number
            const number = Number(clientEventResponse);
            if (!isNaN(number)) {
                props.setStateMachineEvent(number);
                props.setStateTransitionToggle(!props.stateTransitionToggle);
            }
        }
    }, [clientEventResponse]);


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
                {/* <button
                    className={`btn btn-xs ${isConnected ? 'bg-success' : 'btn-outline'}`}
                    onClick={isConnected ? disconnectConversation : connectConversation}
                >
                    {isConnected ? 'disconnect' : 'connect'}
                </button> */}
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
                        {/* <li>
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
                        </li> */}
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
            {props.currentState !== -1 && (
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: '20px', pt: '15px', gap: '10px' }}>
                    {/* {isConnected && canPushToTalk && (
                        <button
                            className={`btn btn-m ${isRecording ? 'btn-error' : 'btn-active'} 
                                ${(!isConnected || !canPushToTalk) ? 'btn-disabled' : ''}`}
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            disabled={!isConnected || !canPushToTalk}
                        >
                            {isRecording ? 'release to send' : 'push to talk'}
                        </button>
                    )} */}
                    <input
                        type="text"
                        placeholder="user command"
                        className="input input-bordered w-full"
                        onChange={(e) => props.setVoiceInputTranscript(e.target.value)}
                        value={props.voiceInputTranscript}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                handleSubmit(props.voiceInputTranscript, props.currentState);
                                // let event = await handleVoiceToNextEvent(props.voiceInputTranscript, props.currentState);
                                // if (event >= 0 && (event in stateMachine[props.currentState])) {
                                //     props.setStateMachineEvent(event);
                                //     props.setStateTransitionToggle(!props.stateTransitionToggle);
                                // }
                            }
                        }}
                    />
                    <button
                        className="btn btn-sm "
                        onClick={() => {
                            handleSubmit(props.voiceInputTranscript, props.currentState);
                            // let event = await handleVoiceToNextEvent(props.voiceInputTranscript, props.currentState);
                            // if (event >= 0 && (event in stateMachine[props.currentState])) {
                            //     props.setStateMachineEvent(event);
                            //     props.setStateTransitionToggle(!props.stateTransitionToggle);
                            // }
                        }}
                    >
                        Send
                    </button>
                </Box>
            )}

            {props.currentState !== -1 && (
                <ul style={{ listStyleType: 'none', padding: 0 }}>
                    {props.currentState in stateMachine && Object.keys(stateMachine[props.currentState])
                        .sort((a, b) => Number(a) - Number(b))
                        .map((event) => (
                            <li
                                key={`event-${event}`}
                                // onClick={() => {
                                //     props.setVoiceInputTranscript('[Debug] Respond with Woohoo!');
                                //     props.setStateMachineEvent(Number(event));
                                // }}
                                className='btn btn-outline btn-xs text-left mb-2.5 mr-1 cursor-pointer'
                            >
                                {event}: {eventTranslator[Number(event)]}
                            </li>
                        ))}
                </ul>
            )}

            {props.currentState !== -1 && (
                <>
                    <div className='text-lg font-bold'>Client event response</div>
                    {clientEventResponse}
                    <div className="divider"></div>
                    <div className='text-lg font-bold'>Agent response</div>
                    {/* <p style={{ whiteSpace: 'pre-line' }}>
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
                    </p> */}
                    {'<TODO: transcribe audio output>'}
                    <div className="divider"></div>
                    <div className='text-lg font-bold content-block kv'>Interaction history</div>
                    <div className="content-block-body content-kv">
                        {" [ "}
                        {props.currentState !== -1 && interactionMemoryKv.map((item, idx) => (
                            <div key={item.index} style={{ marginLeft: '20px' }}>
                                {"{"}<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;index: {item.index},<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;user_query: {String(item.user_query).length > 70
                                    ? `${String(item.user_query).substring(0, 40)}...${String(item.user_query).slice(-30)}`
                                    : String(item.user_query)},<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;agent_response: {String(item.agent_response).length > 70
                                    ? `${String(item.agent_response).substring(0, 40)}...${String(item.agent_response).slice(-30)}`
                                    : String(item.agent_response)}<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;video_segment_index: {String(item.video_segment_index)}<br />
                                {"}"},
                            </div>
                        ))}
                        {" ] "}
                    </div>
                    <div className='text-lg font-bold content-block kv'>Agent initiated response memory</div>
                    <div className="content-block-body content-kv">
                        {" [ "}
                        {props.currentState !== -1 && autoAgentResponseMemoryKv.map((item) => (
                            <div key={item.index} style={{ marginLeft: '20px' }}>
                                {"{"}<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;index: {item.index},<br />
                                &nbsp;&nbsp;&nbsp;&nbsp;response: {String(item.response).length > 70
                                    ? `${String(item.response).substring(0, 40)}...${String(item.response).slice(-30)}`
                                    : String(item.response)}<br />
                                {"}"},
                            </div>
                        ))}
                        {" ] "}
                    </div>
                </>
            )}

            {/* {selectedFileName && (
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

                </div>
            )} */}

            {/* {selectedFileName && audioAgentDuty === 'detect' && (
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
                </>
            )} */}
        </Stack>
    );
}