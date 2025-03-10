"use client";
import { WorkFlowProps } from "../../types/props";
import { InteractionMemoryItem, AutoAgentResponseItem } from "../../types/common";
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
import { WavRecorder, WavStreamPlayer } from '../../wavtools/index.js';
import { XCircle } from 'react-feather';
import DeleteIcon from '@mui/icons-material/Delete';
// @ts-ignore
import { RealtimeClient } from '@openai/realtime-api-beta';
// @ts-ignore
import { ItemType } from "@openai/realtime-api-beta/dist/lib/client";
import secret from '../../../secret.json';
import OpenAI from "openai";
import { repeatPreviousInteraction, getPlaySegmentedVideoFlag } from "./eventStateFunctions";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import ControlTray from "../control-tray/ControlTray";
import { VISUAL_ANALYZE_INTERVAL_MS, AUTO_TIMEOUT_MS } from "../../constants";
import * as utils from "./utils";


const openaiClient = new OpenAI({ apiKey: secret.OPENAI_KEY, dangerouslyAllowBrowser: true });


export default function WorkFlow(props: WorkFlowProps) {
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const openaiRTClientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: secret.OPENAI_KEY, dangerouslyAllowAPIKeyInBrowser: true }));
    const startTimeRef = useRef<string>(new Date().toISOString());
    const conversationRef = useRef<HTMLDivElement>(null);
    const autoResponsesRef = useRef<HTMLDivElement>(null);
    // Add a reference to the file input
    const fileInputRef = useRef<HTMLInputElement>(null);
    const autoAgentResponseMemoryKvRef = useRef<AutoAgentResponseItem[]>([]);
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [items, setItems] = useState<ItemType[]>([]);
    const [interactionMemoryKv, setInteractionMemoryKv] = useState<InteractionMemoryItem[]>([]);
    const [autoAgentResponseMemoryKv, setAutoAgentResponseMemoryKv] = useState<AutoAgentResponseItem[]>([]);
    const [interactionID, setInteractionID] = useState<number>(0);
    const [isRecording, setIsRecording] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [audioAgentDuty, setAudioAgentDuty] = useState<'chatbot' | 'detect'>('detect');
    const [autoResetToInitialState, setAutoResetToInitialState] = useState(false);

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

    /** Bootstrap functions */
    /** Connect to conversation */
    const connectConversation = async () => {
        console.log('[openai realtime client] connected');
        // initiate automatic checking for video-reality alignment
        props.setStateMachineEvent(20);
        props.setCurrentState(0);
        const openaiRTClient = openaiRTClientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;

        // Set state variables
        startTimeRef.current = new Date().toISOString();
        setItems(openaiRTClient.conversation.getItems());

        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await openaiRTClient.connect();
        if (openaiRTClient.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => openaiRTClient.appendInputAudio(data.mono));
        }
        setIsConnected(true);
    };

    /* Disconnect and reset conversation state */
    const disconnectConversation = async () => {
        console.log('[openai realtime client] disconnected');
        props.setStateMachineEvent(-1);
        props.setCurrentState(-1);
        props.setVoiceInputTranscript('')
        setItems([]);
        setInteractionMemoryKv([]);

        // Make sure to update the ref with the latest responses before clearing
        autoAgentResponseMemoryKvRef.current = autoAgentResponseMemoryKv;

        setAutoAgentResponseMemoryKv([]);
        const client = openaiRTClientRef.current;
        client.disconnect();

        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
        setIsConnected(false);
    };


    /**
     * In push-to-talk mode, start recording
     * .appendInputAudio() for each sample
     */
    const startRecording = async () => {
        setIsRecording(true);
        const openaiRTClient = openaiRTClientRef.current;
        const wavRecorder = wavRecorderRef.current;
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (audioAgentDuty === 'chatbot') {
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await openaiRTClient.cancelResponse(trackId, offset);
            }
        }
        await wavRecorder.record((data) => openaiRTClient.appendInputAudio(data.mono));
    };

    /**
     * In push-to-talk mode, stop recording
     */
    const stopRecording = async () => {
        setIsRecording(false);
        const openaiRTClient = openaiRTClientRef.current;
        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.pause();
        if (audioAgentDuty === 'detect') {
            let promptForUserRequestClassification = `Use classify_voice_input function to analyze the user's voice input and classify it into exactly one of the following categories:\n\n
                            ${possibleNextUserEvents.join("\n")}\n
                            Consider the intent behind the user's words, not just the literal meaning. Each category has examples to guide your classification.
                            Respond with ONLY the numerical index (e.g., 0, 1, 2) of the most appropriate category. Do not include any explanation or additional text in your response.`;
            console.log('[user request classification]', promptForUserRequestClassification);
            openaiRTClient.sendUserMessageContent([
                {
                    type: `input_text`,
                    text: promptForUserRequestClassification
                }
            ]);
        } else if (audioAgentDuty === 'chatbot') {
            openaiRTClient.createResponse();
        } else {
            console.error("Invalid audio agent duty");
        }
    };


    /**
     * Switch between Manual <> VAD mode for communication
     */
    const changeTurnEndType = async (value: string) => {
        const openaiRTClient = openaiRTClientRef.current;
        const wavRecorder = wavRecorderRef.current;
        if (value === 'none' && wavRecorder.getStatus() === 'recording') {
            await wavRecorder.pause();
        }
        openaiRTClient.updateSession({
            turn_detection: value === 'none' ? null : { type: 'server_vad' },
        });
        if (value === 'server_vad' && openaiRTClient.isConnected()) {
            await wavRecorder.record((data) => openaiRTClient.appendInputAudio(data.mono));
        }
        setCanPushToTalk(value === 'none');
    };


    const playTTS = async (text: string, speed: number) => {
        try {
            console.log('[TTS play]', text);
            const wavStreamPlayer = wavStreamPlayerRef.current;
            const audioResponse = await openaiClient.audio.speech.create({
                model: "tts-1",
                voice: "alloy",
                input: text,
                response_format: 'pcm',
                speed: speed,
            });
            const arrayBuffer = await audioResponse.arrayBuffer();
            const pcmView = new Int16Array(arrayBuffer);
            const durationMs = (pcmView.length / 24000) * 1000 / speed;
            await wavStreamPlayer.add16BitPCM(arrayBuffer);
            console.log("[TTS Duration]", durationMs);
            
            if (autoResetToInitialState) {
                // Store the current event to check if it changes
                const currentEvent = props.stateMachineEvent;
                
                // Make sure to update the ref with the latest responses
                autoAgentResponseMemoryKvRef.current = autoAgentResponseMemoryKv;
                        
                // Create the timeout
                const timeoutId = setTimeout(() => {
                    // Only proceed if the event hasn't changed
                    if (currentEvent === props.stateMachineEvent) {
                        console.log("[TTS Complete] Returning to initial state");
                        props.setStateMachineEvent(4); // Trigger event 4 (user agreement)
                        props.setStateTransitionToggle(!props.stateTransitionToggle);
                    } else {
                        console.log("[TTS Complete] Event changed, skipping state transition");
                    }
                }, durationMs + AUTO_TIMEOUT_MS);
                        
                // Clean up the timeout if the component unmounts or if the event changes
                return () => clearTimeout(timeoutId);
                    }

        } catch (error) {
            console.error("Error generating or playing TTS:", error);
        }
    };


    /** Event handlers */
    /** Core RealtimeClient and audio capture setup */
    useEffect(() => {
        // Get refs
        const wavStreamPlayer = wavStreamPlayerRef.current;
        const openaiRTClient = openaiRTClientRef.current;
        // Set instructions
        openaiRTClient.updateSession({
            instructions: `System settings:
            Tool use: enabled.

            You are a specialized intent classifier for a cooking assistance application. 
            Your primary role is to analyze user voice inputs and accurately categorize them into predefined categories use the tool classify_voice_input.

            When presented with a user's speech:
            1. Listen carefully to understand the user's primary intent
            2. Match their request to the most appropriate category from the options provided
            3. Respond ONLY with the numerical index (e.g., 0, 1, 2) of the best matching category
            4. DO NOT include any explanations, descriptions, or additional text
            5. If the request seems ambiguous or could fit multiple categories, select the one that best captures the core intent
            
            Context: The user is following a cooking procedure and may ask questions about steps, ingredients, troubleshooting, or request video playback control. Each category represents a different type of user intent within the cooking workflow.
            
            This classification is critical for routing the user's request through the correct state machine path, so accuracy is essential.`,
            tools: [
                {
                    type: 'function',
                    name: 'classify_voice_input',
                    description: `User will provide a request and possible categories. Analyze the user's voice input and classify it into exactly one of the categories provided by the user`,
                    parameters: {
                        type: 'object',
                        properties: {
                            user_request_category: {
                                type: 'number',
                                description: 'The index of the category of the user\'s voice input',
                            },
                        },
                        required: ['user_request_category'],
                    },
                },
            ],
            tool_choice: { type: 'function', name: 'classify_voice_input' }
        });

        // Set transcription, otherwise we don't get user transcriptions back
        openaiRTClient.updateSession({
            input_audio_transcription: { model: 'whisper-1' },
            modalities: ['text', 'audio']
        });

        // handle realtime events from client + server for event logging
        openaiRTClient.on('conversation.updated', async ({ item, delta }: any) => {
            const items = openaiRTClient.conversation.getItems();
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
        openaiRTClient.on('conversation.interrupted', async () => {
            const trackSampleOffset = await wavStreamPlayer.interrupt();
            if (trackSampleOffset?.trackId) {
                const { trackId, offset } = trackSampleOffset;
                await openaiRTClient.cancelResponse(trackId, offset);
            }
        });
        openaiRTClient.on('error', (event: any) => console.error(event));

        setItems(openaiRTClient.conversation.getItems());

        return () => {
            // cleanup; resets to defaults
            openaiRTClient.reset();
        };
    }, []);


    /** Save function call responses to a file (for testing) */
    const saveResponsesToFile = () => {
        const blob = new Blob([JSON.stringify(autoAgentResponseMemoryKv, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "live_api_responses.json";
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
                    break;
                }
            }
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i].role === 'assistant') {
                    // set user event to the non-null value among transcript and text
                    if (items[i].formatted.transcript) {
                        if (Object.keys(stateMachine[props.currentState]).includes(Number(items[i].formatted.transcript).toString())) {
                            let userRequestCategory = Number(items[i].formatted.transcript);
                            props.setStateMachineEvent(userRequestCategory);
                        }
                    } else if (items[i].formatted.text) {
                        if (Object.keys(stateMachine[props.currentState]).includes(Number(items[i].formatted.text).toString())) {
                            let userRequestCategory = Number(items[i].formatted.text);
                            props.setStateMachineEvent(userRequestCategory);
                        }
                    }
                    break;
                }
            }
        }
    }, [items]);


    // Add a new useEffect to handle state transitions only when the event changes
    const previousEventRef = useRef<number>(-1);
    useEffect(() => {
        // Only toggle state transition if the event actually changed
        if (previousEventRef.current !== props.stateMachineEvent && props.voiceInputTranscript.length > 0) {
            console.log('[stable! state transition toggle]');
            props.setStateTransitionToggle(!props.stateTransitionToggle);
            previousEventRef.current = props.stateMachineEvent;
        }
    }, [props.stateMachineEvent, props.voiceInputTranscript]);


    /** Handle state transition */
    useEffect(() => {
        const executeNextState = async () => {
            if (props.stateMachineEvent >= 0) {
                if (props.stateMachineEvent in stateMachine[props.currentState]) {
                    await gotoNextState(
                        props.currentState,
                        props.stateMachineEvent,
                        props.voiceInputTranscript,
                        props.videoKnowledgeInput
                    );
                    props.setCurrentState(
                        stateMachine[props.currentState][props.stateMachineEvent]
                    );
                }
            }
        };
        executeNextState();
    }, [props.stateTransitionToggle, props.videoKnowledgeInput]);


    /** Handle state transition */
    const gotoNextState = async (
        statePrev: number,
        event: number,
        voiceInputTranscript: string,
        videoKnowledgeInput: string
    ) => {
        if (event >= 0 && (event in stateMachine[statePrev])) {
            // handle replay previous interaction 
            if (event === 5) {
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
                props.setAgentResponse(JSON.stringify({ "response": agentResponse, "video_segment_index": videoSegmentIndex }));
                // handle replay segmented video
            } else if (event === 6) {
                let response = await getPlaySegmentedVideoFlag(voiceInputTranscript);
                if (response.response === 0) {
                    props.setSegmentedVideoPlaying(false);
                } else if (response.response === 1) {
                    props.setSegmentedVideoPlaying(true);
                } else if (response.response === 2) {
                    props.setSegmentedVideoPlaying(true);
                    props.setReplaySignal(!props.replaySignal);
                }
                // user agrees (or system idle) and go back to state 0 (agent-initiated)
            } else if (event === 4) {
                props.setSegmentedVideoPlaying(false);
                // store user response to interaction memory
                setInteractionMemoryKv(prevList => [
                    ...prevList,
                    {
                        index: interactionID,
                        user_query: voiceInputTranscript,
                    }
                ]);
                setInteractionID(prev => prev + 1);
                // play auto agent response for event 10 and 12
            } else if (event === 10 || event === 12) {
                let responses = autoAgentResponseMemoryKvRef.current;
                console.log('[ready to play auto agent response]');
                let lastResponse = responses[responses.length - 1];
                console.log('[last response]', lastResponse);
                if (lastResponse.hasProgressedToProcedure) {
                    await playTTS(lastResponse.procedureAnalysis, props.ttsSpeed);
                } else {
                    await playTTS(lastResponse.improvementInstructions, props.ttsSpeed);
                }
            }
            else {
                props.setSegmentedVideoPlaying(false);
                const realityImageBase64 = await props.captureRealityFrame();
                props.setIsProcessing(true);
                console.log('[state function exe input] state: ', stateMachine[statePrev][event], 'voiceInputTranscript: ', voiceInputTranscript);
                let stateFunctionExeRes = await executeStateFunction(
                    stateMachine[statePrev][event],
                    videoKnowledgeInput,
                    realityImageBase64,
                    voiceInputTranscript,
                    interactionMemoryKv,
                    autoAgentResponseMemoryKv
                );
                props.setIsProcessing(false);
                console.log('[state function exe res]');
                console.log(stateFunctionExeRes);

                // Convert object response to string if necessary
                const stringifiedResponse = typeof stateFunctionExeRes === 'object'
                    ? JSON.stringify(stateFunctionExeRes, null, 2)
                    : String(stateFunctionExeRes);

                if (stringifiedResponse !== props.agentResponse) {
                    props.setAgentResponse(stringifiedResponse);
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
                        // play the natural language response from the agent
                        if (typeof stateFunctionExeRes === 'object') {
                            await playTTS(String(stateFunctionExeRes.response), props.ttsSpeed);
                        } else {
                            await playTTS(stringifiedResponse, props.ttsSpeed);
                        }
                    } else {
                        console.log('[no voice input transcript]');
                    }
                }
                return;
            }
        };
    }

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


    // liveAPI: system automatic trigger
    useEffect(() => {
        const procedures = utils.extractProcedureSequence(props.videoKnowledgeInput);
        const numberedProcedures = procedures.length > 0
            ? procedures.map((proc, idx) => `${idx + 1}. ${proc}`).join('\n')
            : "No procedures found in video knowledge";

        const repeatingPrompt =
            "You are a cooking assistant that analyzes video streams. Use compareStreamWithReferenceVideoKnowledge tool to analyze the video stream. " +
            "Your task has two distinct parts:\n\n" +
            "PART 1 - OBJECTIVE OBSERVATION (what you actually see):\n" +
            "First, analyze ONLY what you can directly observe in the current video stream:\n" +
            "1. Describe the specific cooking procedure being performed at this moment\n" +
            "2. Describe the specific step being performed at this moment\n" +
            "3. Describe the visible food items, ingredients, and kitchenware\n" +
            "4. Describe any cooking-related sounds\n\n" +

            "IMPORTANT: In Part 1, do NOT reference or compare with the reference knowledge. Only describe what you actually observe.\n\n" +

            "PART 2 - COMPARISON WITH REFERENCE (after observation):\n" +
            "After completing your objective observation, compare what you observed with the reference cooking knowledge:\n" +
            "1. Is the observed cooking step valid according to reference knowledge? (true/false)\n" +
            "2. Is the observed step being executed correctly? (true/false)\n" +
            "3. Is the user missing any procedures from the reference knowledge? (true/false)\n" +
            "4. Has the user progressed to a new procedure? (true/false)\n\n" +

            "If the user is missing procedures or performing steps incorrectly, provide specific improvement instructions.\n\n" +

            "REFERENCE KNOWLEDGE (do not hallucinate this as being in the video):\n" +
            "The correct procedure sequence according to the reference is:\n" +
            numberedProcedures + "\n\n" +

            "PREVIOUS OBSERVATION:\n";

        let intervalId: NodeJS.Timeout | null = null;

        // Only start the interval if we're connected and in the correct state
        // If autoResetToInitialState is enabled, we should be more lenient about the state check
        const shouldRunAnalysis = isConnected && liveAPIConnected &&
            (props.currentState === 0 || (autoResetToInitialState && props.currentState >= 0));

        if (shouldRunAnalysis) {
            console.log("Starting visual analysis interval");
            intervalId = setInterval(() => {
                // Double-check we're still connected before sending
                // If autoResetToInitialState is enabled, we should be more lenient about the state check
                const stillShouldRunAnalysis = liveAPIConnected &&
                    (props.currentState === 0 || (autoResetToInitialState && props.currentState >= 0));

                if (!stillShouldRunAnalysis) {
                    console.log("Not connected or not in the correct state");
                    return;
                }

                const responses = autoAgentResponseMemoryKvRef.current;
                if (responses.length === 0) {
                    liveAPIClient.send([{ text: repeatingPrompt + "No previous action: just started cooking." }]);
                } else {
                    const lastResponseInfo =
                        "Procedure: " + responses[responses.length - 1].procedureAnalysis + "\n" +
                        "Step: " + responses[responses.length - 1].stepAnalysis + "\n" +
                        "Food and kitchenware analysis: " + responses[responses.length - 1].foodAndKitchenwareAnalysis + "\n" +
                        "Audio analysis: " + responses[responses.length - 1].audioAnalysis + "\n";
                    liveAPIClient.send([{ text: repeatingPrompt + lastResponseInfo }]);
                }
            }, VISUAL_ANALYZE_INTERVAL_MS);
        }

        return () => {
            if (intervalId) {
                console.log("Clearing visual analysis interval");
                clearInterval(intervalId);
            }
        };
    }, [isConnected, liveAPIConnected, props.currentState, props.videoKnowledgeInput, liveAPIClient, autoResetToInitialState]);


    // trigger state transition for event 10 and 12 when auto agent detects issues
    useEffect(() => {
        // Always update the ref with the latest responses, regardless of state
        autoAgentResponseMemoryKvRef.current = autoAgentResponseMemoryKv;

        if (props.currentState === 0) {
            const responses = autoAgentResponseMemoryKvRef.current;
            const lastResponse = responses[responses.length - 1];
            // console.log('[liveAPI function call response]');
            if (lastResponse?.isValidCookingStep) {
                const hasInstructions = lastResponse.improvementInstructions.length > 0;
                const needsCorrection = !lastResponse.isCorrectProcedureOrder || !lastResponse.isStepCorrect;

                if (needsCorrection && hasInstructions) {
                    console.log("[Instruction]: " + lastResponse.improvementInstructions);
                    if (!lastResponse.isStepCorrect) {
                        props.setStateMachineEvent(10); // 10: System automatically detects food state misalignment
                    } else {
                        props.setStateMachineEvent(12); // 12: System automatically detects missing previous steps
                    }
                    props.setAgentResponse(JSON.stringify({ "response": lastResponse.improvementInstructions }));
                    // @TODO: debug only
                    props.videoRef.current?.pause();
                    props.setStateTransitionToggle(!props.stateTransitionToggle);
                } else if (needsCorrection) {
                    console.log("[Incorrect detected, but no instruction provided]");
                }

                if (lastResponse.hasProgressedToProcedure) {
                    console.log("[new procedure]: " + lastResponse.procedureAnalysis);
                    // props.setAgentResponse(JSON.stringify({ "response": lastResponse.procedureAnalysis }));
                    // props.setStateTransitionToggle(!props.stateTransitionToggle);
                }
            }
        }
    }, [autoAgentResponseMemoryKv]);

    // Add this effect to handl e auto-scrolling
    useEffect(() => {
        if (autoResponsesRef.current) {
            autoResponsesRef.current.scrollTop = autoResponsesRef.current.scrollHeight;
        }
    }, [autoAgentResponseMemoryKv]); // Scroll when responses update


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
                        <li className="menu-title">Auto Reset</li>
                        <li>
                            <label className="label cursor-pointer">
                                <span className="label-text">Auto reset to initial state</span>
                                <input
                                    type="checkbox"
                                    className={`toggle toggle-sm ${autoResetToInitialState ? 'toggle-base' : 'toggle-neutral'}`}
                                    checked={autoResetToInitialState}
                                    onChange={() => setAutoResetToInitialState(!autoResetToInitialState)}
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

            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: '20px', pt: '15px', gap: '10px' }}>
                <button
                    className={`btn btn-m ${isRecording ? 'btn-error' : 'btn-active'} 
                                    ${(!isConnected || !canPushToTalk) ? 'btn-disabled' : ''}`}
                    onMouseDown={startRecording}
                    onMouseUp={stopRecording}
                    disabled={!isConnected || !canPushToTalk}
                >
                    {isRecording ? 'release to send' : 'push to talk'}
                </button>
                <input
                    type="text"
                    placeholder="User command. Press 'enter' to submit..."
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
            </Box>

            <div className="divider"></div>

            <div className='flex items-center gap-2'>
                <div className='text-lg font-bold'>Agent response</div>
                {props.currentState !== -1 && (props.isProcessing && <span className="loading loading-dots loading-lg"></span>)}
            </div>
            {props.currentState !== -1 && (
                <p style={{ whiteSpace: 'pre-line' }}>
                    {(() => {
                        try {
                            const parsed = typeof props.agentResponse === 'string'
                                ? JSON.parse(props.agentResponse)
                                : props.agentResponse;
                            return parsed.response || props.agentResponse;
                        } catch {
                            return props.agentResponse;
                        }
                    })()}
                </p>
            )}
            <div className="divider"></div>

            <div className='flex items-center gap-2'>
                <div className='text-lg font-bold'>Real-time visual agent responses</div>
                <label
                    className="btn btn-xs btn-outline cursor-pointer"
                    onClick={saveResponsesToFile}
                >
                    Save
                </label>
            </div>
            <div
                ref={autoResponsesRef}
                className="content-block-body content-kv"
                style={{
                    height: '300px',
                    overflowY: 'auto',
                    padding: '10px',
                }}
            >
                {" [ "}
                {props.currentState !== -1 && autoAgentResponseMemoryKv.map((item, idx) => (
                    <div key={`agent-initiated-response-${idx}`} style={{ marginLeft: '20px' }}>
                        {"{"}<br />
                        {Object.entries(item).map(([key, value], index) => (
                            <span key={index}>
                                &nbsp;&nbsp;&nbsp;&nbsp;{key}: {String(value).length > 70
                                    ? `${String(value).substring(0, 40)}...${String(value).slice(-30)}`
                                    : String(value)}<br />
                            </span>
                        ))}
                        {"}"},
                    </div>
                ))}
                {" ] "}
            </div>

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
                                    props.setStateTransitionToggle(!props.stateTransitionToggle);
                                }}
                                className='btn btn-outline btn-xs text-left mb-2.5 mr-1 cursor-pointer'
                            >
                                {event}: {eventTranslator[Number(event)]}
                            </li>
                        ))}
                </ul>
            )}

            <ControlTray
                videoRef={props.videoRef}
                supportsVideo={true}
                currentState={props.currentState}
                videoKnowledgeInput={props.videoKnowledgeInput}
                autoAgentResponseMemoryKv={autoAgentResponseMemoryKv}
                onVideoStreamChange={props.setVideoStream}
                setStateMachineEvent={props.setStateMachineEvent}
                setCurrentState={props.setCurrentState}
                connectConversation={connectConversation}
                disconnectConversation={disconnectConversation}
                setAutoAgentResponseMemoryKv={setAutoAgentResponseMemoryKv}
                setVoiceInputTranscript={props.setVoiceInputTranscript}
            />
        </Stack >
    );
}