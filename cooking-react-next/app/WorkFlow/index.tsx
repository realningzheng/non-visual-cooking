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
import { repeatPreviousInteraction, getPlaySegmentedVideoFlag } from "./eventStateFunctions";
import { useLiveAPIContext } from "../contexts/LiveAPIContext";
import ControlTray from "../components/control-tray/ControlTray";


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
    setSegmentedVideoPlaying: (input: boolean) => void;
    setReplaySignal: (input: boolean) => void;
    stateTransitionToggle: boolean;
    voiceInputTranscript: string;
    videoKnowledgeInput: string;
    currentState: number;
    stateMachineEvent: number;
    realityImageBase64: string;
    stateFunctionExeRes: string;
    isProcessing: boolean;
    ttsSpeed: number;
    replaySignal: boolean;
    videoRef: React.RefObject<HTMLVideoElement>;
    isSystemActiveEnabled: boolean;
    setIsSystemActiveEnabled: (input: boolean) => void;
    setVideoStream: (stream: MediaStream | null) => void;
}


const openaiClient = new OpenAI({ apiKey: secret.OPENAI_KEY, dangerouslyAllowBrowser: true });


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
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const clientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: secret.OPENAI_KEY, dangerouslyAllowAPIKeyInBrowser: true }));
    const startTimeRef = useRef<string>(new Date().toISOString());
    const conversationRef = useRef<HTMLDivElement>(null);
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [items, setItems] = useState<ItemType[]>([]);
    const [interactionMemoryKv, setInteractionMemoryKv] = useState<InteractionMemoryItem[]>([]);
    const [autoAgentResponseMemoryKv, setAutoAgentResponseMemoryKv] = useState<AutoAgentResponseItem[]>([]);
    const [interactionID, setInteractionID] = useState<number>(0);
    const [autoAgentResponseID, setAutoAgentResponseID] = useState<number>(0);
    const [isRecording, setIsRecording] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [audioAgentDuty, setAudioAgentDuty] = useState<'chatbot' | 'detect'>('detect');
    const [systemActivePrompt, setSystemActivePrompt] = useState<string>('');

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

    const {
        client: liveAPIClient,
        connected: liveAPIConnected,
        content: liveAPIContent,
        turnComplete: liveAPITurnComplete,
    } = useLiveAPIContext();
    const [liveClientResponse, setLiveClientResponse] = useState('');
    const prevEventTurnComplete = useRef(false);
    const [rtTriggerAudio, setRtTriggerAudio] = useState<string>('');


    /** Bootstrap functions */
    /** Connect to conversation */
    const connectConversation = async () => {
        console.log('[connectConversation]');
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
        console.log('[disconnectConversation]');
        props.setStateMachineEvent(-1);
        props.setCurrentState(-1);
        setIsConnected(false);
        setItems([]);
        setInteractionMemoryKv([]);

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


    // useEffect(() => {
    //     let mounted = true;

    //     const initializePCMData = async () => {
    //         try {
    //             const response = await openaiClient.audio.speech.create({
    //                 model: "tts-1",
    //                 voice: "alloy",
    //                 input: "Can you describe the image for me?",
    //                 response_format: 'pcm',
    //                 speed: 1,
    //             });

    //             if (mounted) {
    //                 const arrayBuffer = await response.arrayBuffer();
    //                 const pcmData = new Uint8Array(arrayBuffer);
                    
    //                 // Convert from 24kHz to 16kHz
    //                 const pcmData16k = convert24kHzTo16kHz(pcmData);
                    
    //                 // Convert to base64 for sending
    //                 const base64 = btoa(String.fromCharCode(...pcmData16k));
    //                 setRtTriggerAudio(base64);
    //             }
    //         } catch (error) {
    //             if (mounted) {
    //                 console.error('Error getting PCM data:', error);
    //             }
    //         }
    //     };

    //     initializePCMData();

    //     return () => {
    //         mounted = false;
    //     };
    // }, []);


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
                setInteractionMemoryKv(prevList => [
                    ...prevList,
                    {
                        index: interactionID,
                        memorized_item_key: key,
                        memorized_item_value: value
                    }
                ]);
                setInteractionID(prev => prev + 1);
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


    /** Handle realtime video stream response */
    /** Listen to event detection content stream */
    useEffect(() => {
        // When turnComplete switches from true to false, reset the state
        if (!liveAPITurnComplete && prevEventTurnComplete.current) {
            setLiveClientResponse('');
        }

        // Only process content when we're in the middle of a turn
        if (liveAPIContent.length > 0 && !liveAPITurnComplete) {
            setLiveClientResponse(prev => {
                // Check if content is already at the end of prev
                if (!prev.endsWith(liveAPIContent)) {
                    return prev + liveAPIContent;
                }
                return prev;
            });
        }

        // Update the ref for next render
        prevEventTurnComplete.current = liveAPITurnComplete;
    }, [liveAPIContent, liveAPITurnComplete]);

    /** Save all responses to a file (for testing) */
    const [allResponses, setAllResponses] = useState<string[]>([]);
    useEffect(() => {
        const saveInterval = setInterval(() => {
            if (allResponses.length > 0) {
                saveResponsesToFile();
            }
        }, 10000); // Saves every 10 seconds

        return () => clearInterval(saveInterval);
    }, [allResponses]);

    const saveResponsesToFile = () => {
        const blob = new Blob([allResponses.join("\n")], { type: "text/plain" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "live_api_responses.txt";
        a.click();
        URL.revokeObjectURL(a.href);
    };

    

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


    /** Handle state transition */
    const gotoNextState = async (
        statePrev: number,
        event: number,
        voiceInputTranscript: string,
        videoKnowledgeInput: string
    ) => {
        if (event >= 0 && (event in stateMachine[statePrev])) {
            if (event === 5) {              // handle replay previous interaction 
                let retrievedResponse = await repeatPreviousInteraction(
                    voiceInputTranscript,
                    interactionMemoryKv
                );
                let retrievedIndex = Number(retrievedResponse.response);
                let retrievedInfo = interactionMemoryKv[retrievedIndex];
                let agentResponse = retrievedInfo.agent_response;
                let videoSegmentIndex = retrievedInfo.video_segment_index;
                if (agentResponse) {
                    await playTTS(agentResponse, props.ttsSpeed);
                }
                props.setStateFunctionExeRes(JSON.stringify({ "response": agentResponse, "video_segment_index": videoSegmentIndex }));
            } else if (event === 6) {       // handle replay segmented video
                let response = await getPlaySegmentedVideoFlag(voiceInputTranscript);
                if (response.response === 0) {
                    props.setSegmentedVideoPlaying(false);
                } else if (response.response === 1) {
                    props.setSegmentedVideoPlaying(true);
                } else if (response.response === 2) {
                    props.setSegmentedVideoPlaying(true);
                    props.setReplaySignal(!props.replaySignal);
                }
            } else {
                props.setSegmentedVideoPlaying(false);
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
                const stringifiedResponse = typeof stateFunctionExeRes === 'object'
                    ? JSON.stringify(stateFunctionExeRes, null, 2)
                    : String(stateFunctionExeRes);

                if (stringifiedResponse !== props.stateFunctionExeRes) {
                    props.setStateFunctionExeRes(stringifiedResponse);
                    // store user input and agent response
                    if (voiceInputTranscript.length > 0) {
                        if (typeof stateFunctionExeRes === 'object') {
                            setInteractionMemoryKv(prevList => [
                                ...prevList,
                                {
                                    index: interactionID,
                                    user_query: voiceInputTranscript,
                                    agent_response: stateFunctionExeRes.response,
                                    video_segment_index: stateFunctionExeRes.video_segment_index
                                }
                            ]);
                            setInteractionID(prev => prev + 1);
                        }

                        // store auto agent response
                        if (typeof stateFunctionExeRes !== 'object') {
                            setAutoAgentResponseMemoryKv(prevList => [
                                ...prevList,
                                {
                                    index: autoAgentResponseID,
                                    response: stringifiedResponse
                                }
                            ]);
                            setAutoAgentResponseID(prev => prev + 1);
                        }

                        // play the natural language response from the agent
                        if (typeof stateFunctionExeRes === 'object') {
                            await playTTS(String(stateFunctionExeRes.response), props.ttsSpeed);
                        } else {
                            await playTTS(stringifiedResponse, props.ttsSpeed);
                        }
                    }
                }
                return;
            }
        };
    }


    /** Handle state transition */
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

    // liveAPI: system automatic trigger
    useEffect(() => {
        if (!props.videoKnowledgeInput) return;
        const firstPrompt = 
            "The following is a cooking video description.\n" +
            props.videoKnowledgeInput;
        const repeatingPrompt = 
            "Based on the video description, the past conversation, and the current reality, " +
            "please try to align the reality with the video description, and answer the following question:\n" +
            "Is the image related to the video description? " +
            "If no, please respond with only the word `irrelavent` and ignore the following questions. If yes, respond the following questions:\n" +
            "Is the user still in the same precedure as the last detected procedure? " + 
            "If yes, please respond with the procedure name. and ignore the following questions. " +
            "If no, please respond with `new procedure: procedure name` and answer the following questions:\n" + 
            "Is this new precedure in the correct order (according to the video description? " + 
            "If yes, please respond with `correct order`. If no, please respond with `incorrect order`.\n";
            "";
    
        let intervalId: NodeJS.Timeout | null = null;
        let hasSentFirstPrompt = false;  // Track whether the first prompt has been sent
    
        if (isConnected) {
            // Send the first message immediately
            liveAPIClient.send([{ text: firstPrompt }]);
            hasSentFirstPrompt = true;
    
            // Start the interval for subsequent messages
            intervalId = setInterval(() => {
                if (hasSentFirstPrompt) {
                    liveAPIClient.send([{ text: repeatingPrompt }]);
                }
            }, 5000);
        }
    
        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [isConnected]); 
    
    

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

            {isConnected && (
                <>
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
                        <button
                            className="btn btn-outline"
                            onClick={async () => { 
                                let event = await asyncNextEventChooser(props.voiceInputTranscript, props.currentState);
                                if (event >= 0 && (event in stateMachine[props.currentState])) {
                                    props.setStateMachineEvent(event);
                                    props.setStateTransitionToggle(!props.stateTransitionToggle);
                                }
                            }}
                        >
                            [Debug use] Send User Initiated Request
                        </button>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: '20px', pt: '15px', gap: '10px' }}>
                        <input
                            type="text"
                            placeholder="Tell me what you see."
                            className="input input-bordered w-full"
                            onChange={(e) => setSystemActivePrompt(e.target.value)}
                            value={systemActivePrompt}
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    liveAPIClient.send([{ text: systemActivePrompt }])
                                }
                            }}
                        />
                        <button
                            className="btn btn-outline"
                            onClick={() => liveAPIClient.send([{ text: systemActivePrompt }])}
                        >
                            [Debug use] Send System Initiated Request
                        </button>
                    </Box>
                </>
            )}

            {isConnected &&
                <>
                    <div className='flex items-center gap-2'>
                        <div className='text-lg font-bold'>Live visual client</div>
                    </div>
                    {liveClientResponse}
                </>
            }

            {isConnected &&
                <>
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
                        {items.map((conversationItem:any, i:any) => {
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
                        <div className='text-lg font-bold'>Agent response</div>
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
            }
            <ControlTray
                videoRef={props.videoRef}
                currentState={props.currentState}
                supportsVideo={true}
                rtTriggerAudio={rtTriggerAudio}
                onVideoStreamChange={props.setVideoStream}
                setStateMachineEvent={props.setStateMachineEvent}
                setCurrentState={props.setCurrentState}
                connectConversation={connectConversation}
                disconnectConversation={disconnectConversation}
            />
        </Stack >
    );
}


// function convert24kHzTo16kHz(input24kHz: Uint8Array): Uint8Array {
//     // Convert Uint8Array to Float32Array for processing
//     const float32Data = new Float32Array(input24kHz.length / 2);
//     for (let i = 0; i < input24kHz.length; i += 2) {
//         // Combine two 8-bit values into one 16-bit value
//         const sample = (input24kHz[i + 1] << 8) | input24kHz[i];
//         // Convert to float32 (-1 to 1 range)
//         float32Data[i / 2] = sample / 32768.0;
//     }

//     // Calculate the new length for 16kHz
//     const ratio = 16000 / 24000;
//     const newLength = Math.floor(float32Data.length * ratio);
//     const output16kHz = new Float32Array(newLength);

//     // Linear interpolation for downsampling
//     for (let i = 0; i < newLength; i++) {
//         const position = i / ratio;
//         const index = Math.floor(position);
//         const fraction = position - index;

//         // Linear interpolation between samples
//         const sample1 = float32Data[index];
//         const sample2 = float32Data[Math.min(index + 1, float32Data.length - 1)];
//         output16kHz[i] = sample1 + fraction * (sample2 - sample1);
//     }

//     // Convert back to Uint8Array
//     const result = new Uint8Array(newLength * 2);
//     for (let i = 0; i < newLength; i++) {
//         // Convert float32 back to 16-bit integer
//         const sample = Math.max(-1, Math.min(1, output16kHz[i]));
//         const int16 = Math.floor(sample * 32767);
        
//         // Split into two 8-bit values
//         result[i * 2] = int16 & 0xFF;
//         result[i * 2 + 1] = (int16 >> 8) & 0xFF;
//     }

//     return result;
// }