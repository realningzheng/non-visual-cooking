"use client";
import { WorkFlowProps } from "../../types/props";
import { InteractionMemoryItem, AutoAgentResponseItem, CombinedMemoryItem } from "../../types/common";
import { Stack, Box, TextField, IconButton, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TTSPlayer from "../tts-player/TTSPlayer";
import { visualAnalysisPromptPrefix } from "@/app/prompts";


export default function WorkFlow(props: WorkFlowProps) {
    const wavRecorderRef = useRef<WavRecorder>(new WavRecorder({ sampleRate: 24000 }));
    const wavStreamPlayerRef = useRef<WavStreamPlayer>(new WavStreamPlayer({ sampleRate: 24000 }));
    const openaiRTClientRef = useRef<RealtimeClient>(new RealtimeClient({ apiKey: secret.OPENAI_KEY, dangerouslyAllowAPIKeyInBrowser: true }));
    const startTimeRef = useRef<string>(new Date().toISOString());
    const conversationRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const sessionStartTime = useRef<number | null>(null);
    const memoryDivRef = useRef<HTMLDivElement>(null);

    const [ttsInput, setTTSInput] = useState('');
    const [selectedFileName, setSelectedFileName] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [items, setItems] = useState<ItemType[]>([]);
    const [combinedMemory, setCombinedMemory] = useState<CombinedMemoryItem[]>([]);
    const [isRecording, setIsRecording] = useState(false);
    const [canPushToTalk, setCanPushToTalk] = useState(true);
    const [audioAgentDuty, setAudioAgentDuty] = useState<'chatbot' | 'detect'>('detect');
    const [autoResetToInitialState, setAutoResetToInitialState] = useState(false);
    const [expandedPanels, setExpandedPanels] = useState<{ [key: string]: boolean }>({
        'visual-responses': false,
        'interaction-history': false,
        'agent-response': true,
        'possible-next-events': false
    });


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


    /** Load a default video knowledge to save time */
    useEffect(() => {
        const loadDefaultVideoKnowledge = async () => {
            const response = await fetch('/lH7pgsnyGrI_core_video_knowledge.json');
            const data = await response.json();
            props.setVideoKnowledgeInput(JSON.stringify(data));
            setSelectedFileName('lH7pgsnyGrI_core.json');
        }
        loadDefaultVideoKnowledge();
    }, []);


    const {
        client: liveAPIClient,
        connected: liveAPIConnected,
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
        sessionStartTime.current = Date.now();
        setItems(openaiRTClient.conversation.getItems());
        setIsConnected(true);

        await wavRecorder.begin();
        await wavStreamPlayer.connect();
        await openaiRTClient.connect();
        if (openaiRTClient.getTurnDetectionType() === 'server_vad') {
            await wavRecorder.record((data) => openaiRTClient.appendInputAudio(data.mono));
        }
    };


    /** Disconnect conversation */
    const disconnectConversation = async () => {
        console.log('[openai realtime client] disconnected');
        const wavRecorder = wavRecorderRef.current;
        await wavRecorder.end();
        setIsConnected(false);
        sessionStartTime.current = null;
        props.setStateMachineEvent(-1);
        props.setCurrentState(-1);
        props.setVoiceInputTranscript('')
        setItems([]);
        props.setAgentResponse('');

        setCombinedMemory([]);

        const client = openaiRTClientRef.current;
        client.disconnect();

        const wavStreamPlayer = wavStreamPlayerRef.current;
        await wavStreamPlayer.interrupt();
    };


    /**
     * In push-to-talk mode, start recording
     * .appendInputAudio() for each sample
     */
    const startRecording = async () => {
        setIsRecording(true);
        setTTSInput('');
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
            let promptForUserRequestClassification = `Analyze the user's voice input and classify it into exactly one of the following categories:\n\n
                            ${possibleNextUserEvents.join("\n")}\n
                            Consider the intent behind the user's words, not just the literal meaning.`;
            // console.log('[user request classification]', promptForUserRequestClassification);
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
            User's request is provided in audio, the categories are provided in text.

            When presented with a user's speech:
            1. Match their request to the most appropriate category from the options provided
            2. Respond ONLY with the numerical index (e.g., 0, 1, 2) of the best matching category. DO NOT include any explanations, descriptions, or additional text
            3. If the request seems ambiguous or could fit multiple categories, select the one that best captures the core intent
            
            Context: The user is following a cooking procedure and may ask questions about steps, ingredients, troubleshooting, or request video playback control. 
            Each category represents a different type of user intent within the cooking workflow.
            
            This classification is critical for routing the user's request through the correct state machine path, so accuracy is essential.`,
            tools: [
                {
                    type: 'function',
                    name: 'classify_voice_input',
                    description: `Every time the user finishes speaking, classify the user's voice input into exactly one of the categories`,
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
            tool_choice: 'auto'
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
    const saveResponsesToFileAsync = async () => {
        const blob = new Blob([JSON.stringify(combinedMemory, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        a.download = `combined_memory_responses_${timestamp}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        return Promise.resolve();
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


    const prevEventAndTranscriptRef = useRef<{ event: number, transcript: string }>({ event: -1, transcript: '' });
    const transcriptTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isTranscriptStableRef = useRef<boolean>(true);

    useEffect(() => {
        if (props.voiceInputTranscript.length === 0) return;
        const currentTranscript = props.voiceInputTranscript;
        const prevTranscript = prevEventAndTranscriptRef.current.transcript;

        // If transcript hasn't changed, do nothing
        if (currentTranscript === prevTranscript) return;

        // Mark transcript as unstable when it changes
        isTranscriptStableRef.current = false;

        // Clear any existing timer
        if (transcriptTimerRef.current) {
            clearTimeout(transcriptTimerRef.current);
        }

        // Set a new timer for this transcript change
        transcriptTimerRef.current = setTimeout(() => {
            // When timer fires, transcript is considered stable
            isTranscriptStableRef.current = true;

            // Only toggle state transition if transcript actually changed from the previously stable one
            if (currentTranscript !== prevTranscript) {
                props.setStateTransitionToggle(!props.stateTransitionToggle);

                // Update the ref with the new stable transcript
                prevEventAndTranscriptRef.current = {
                    event: prevEventAndTranscriptRef.current.event,
                    transcript: currentTranscript
                };
            }

            transcriptTimerRef.current = null;
        }, 500); // 500ms debounce time - adjust as needed

        // Cleanup function
        return () => {
            if (transcriptTimerRef.current) {
                clearTimeout(transcriptTimerRef.current);
            }
        };
    }, [props.voiceInputTranscript]);


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
                // get type 'conversation' from combinedMemoryRef
                let interactionMemory = combinedMemory.filter(item => item.type === 'conversation');
                if (!interactionMemory) return;
                let retrievedResponse = await repeatPreviousInteraction(
                    voiceInputTranscript,
                    interactionMemory
                );

                let retrievedIndex = Number(retrievedResponse.response);
                let retrievedInfo = interactionMemory[retrievedIndex];
                let agentResponse = (retrievedInfo.content as InteractionMemoryItem).agent_response;
                let videoSegmentIndex = (retrievedInfo.content as InteractionMemoryItem).video_segment_index;
                setTTSInput(agentResponse || '');
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
                setCombinedMemory(prevList => [
                    ...prevList,
                    {
                        index: prevList.length,
                        type: 'conversation',
                        content: {
                            user_query: "I agree with your response",
                        },
                        timestamp: sessionStartTime.current ? String((Date.now() - sessionStartTime.current) / 1000) : '0'
                    }
                ]);
                // play auto agent response for event 10 and 12
            } else if (event === 10 || event === 12) {
                let responses = combinedMemory.filter(item => item.type === 'cooking_scene_desc');
                console.log('[ready to play auto agent response]');
                let lastResponse = responses[responses.length - 1].content as AutoAgentResponseItem;
                console.log('[last response]', lastResponse);
                setTTSInput(lastResponse.improvementInstructions);
            }
            else {
                props.setSegmentedVideoPlaying(false);
                const realityImageBase64 = await props.captureRealityFrame();
                props.setIsProcessing(true);
                console.log('[state function exe input] statePrev: ')
                console.log(statePrev)
                console.log('[state function exe input] voiceInputTranscript: ')
                console.log(voiceInputTranscript)
                let stateFunctionExeRes = await executeStateFunction(
                    stateMachine[statePrev][event],
                    videoKnowledgeInput,
                    realityImageBase64,
                    voiceInputTranscript,
                    combinedMemory
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
                            setCombinedMemory(prevList => [
                                ...prevList,
                                {
                                    index: prevList.length,
                                    type: 'conversation',
                                    content: {
                                        user_query: voiceInputTranscript,
                                        agent_response: stateFunctionExeRes.response,
                                        video_segment_index: stateFunctionExeRes.video_segment_index,
                                    },
                                    timestamp: sessionStartTime.current ? String((Date.now() - sessionStartTime.current) / 1000) : '0'
                                }
                            ]);
                        }
                        // play the natural language response from the agent
                        if (typeof stateFunctionExeRes === 'object') {
                            setTTSInput(String(stateFunctionExeRes.response));
                        } else {
                            setTTSInput(stringifiedResponse);
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

    const numberedProceduresRef = useRef<string>();
    useEffect(() => {
        const procedures = utils.extractProcedureSequence(props.videoKnowledgeInput);
        const numberedProcedures = procedures.length > 0
            ? procedures.map((proc, idx) => `${idx + 1}. ${proc}`).join('\n')
            : "No procedures found in video knowledge";
        numberedProceduresRef.current = numberedProcedures;
    }, [props.videoKnowledgeInput]);

    // liveAPI: system automatic trigger
    useEffect(() => {
        let intervalId: NodeJS.Timeout | null = null;
        if (props.currentState === 0 && isConnected && liveAPIConnected) {
            const visualAnalysisPrompt = visualAnalysisPromptPrefix + "\n\n" +
                "The correct procedure sequence according to the reference is:\n" +
                numberedProceduresRef.current + "\n\n"

            intervalId = setInterval(() => {
                const responses = combinedMemory.filter(item => item.type === 'cooking_scene_desc');
                if (responses.length === 0) {
                    liveAPIClient.send([{ text: visualAnalysisPrompt + "No previous action: just started cooking." }]);
                } else {
                    const lastResponseInfo =
                        "PREVIOUS OBSERVATION:\n" +
                        "• Procedure: " + (responses[responses.length - 1].content as AutoAgentResponseItem).procedureAnalysis + "\n" +
                        "• Step: " + (responses[responses.length - 1].content as AutoAgentResponseItem).stepAnalysis + "\n" +
                        "• Food & Kitchenware: " + (responses[responses.length - 1].content as AutoAgentResponseItem).foodAndKitchenwareAnalysis + "\n" +
                        "• Audio: " + (responses[responses.length - 1].content as AutoAgentResponseItem).audioAnalysis + "\n" +
                        ((responses[responses.length - 1].content as AutoAgentResponseItem).improvementInstructions ? "• Previous Issues: " + (responses[responses.length - 1].content as AutoAgentResponseItem).improvementInstructions : "");

                    liveAPIClient.send([{ text: visualAnalysisPrompt + lastResponseInfo }]);
                }
            }, VISUAL_ANALYZE_INTERVAL_MS);
        }

        return () => {
            if (intervalId !== null) {
                console.log("Clearing visual analysis interval");
                clearInterval(intervalId);
            }
        };
    }, [isConnected, liveAPIConnected, props.currentState, props.videoKnowledgeInput, autoResetToInitialState]);


    // trigger state transition for event 10 and 12 when auto agent detects issues
    useEffect(() => {
        if (props.currentState !== 0) return;
        //  if the last response is conversation, return
        if (combinedMemory[combinedMemory.length - 1].type === 'conversation') return;
        
        let autoAgentResponseMemory = combinedMemory.filter(item => item.type === 'cooking_scene_desc');
        if (autoAgentResponseMemory.length === 0) return;
        let lastResponse = autoAgentResponseMemory[autoAgentResponseMemory.length - 1];

        let lastResponseContent = lastResponse.content as AutoAgentResponseItem;

        const hasInstructions = lastResponseContent.improvementInstructions.length > 0;
        const needsCorrection = !lastResponseContent.isCorrectProcedureOrder || !lastResponseContent.isStepCorrect;

        if (needsCorrection && hasInstructions) {
            console.log("[Instruction]: " + lastResponseContent.improvementInstructions);
            if (!lastResponseContent.isStepCorrect) {
                props.setStateMachineEvent(10); // 10: System automatically detects food state misalignment
            } else {
                props.setStateMachineEvent(12); // 12: System automatically detects missing previous steps
            }
            props.setAgentResponse(JSON.stringify({ "response": lastResponseContent.improvementInstructions }));
            // debug video simulation only
            // props.videoRef.current?.pause();
            props.setStateTransitionToggle(!props.stateTransitionToggle);
        }

    }, [combinedMemory]);

    // Add this effect to handl e auto-scrolling
    useEffect(() => {
        if (memoryDivRef.current) {
            memoryDivRef.current.scrollTop = memoryDivRef.current.scrollHeight;
        }
    }, [combinedMemory]); // Scroll when responses update

    // Add session start time initialization
    useEffect(() => {
        if (isConnected && sessionStartTime.current === null) {
            sessionStartTime.current = Date.now();
        } else if (!isConnected) {
            sessionStartTime.current = null;
        }
    }, [isConnected]);

    const handlePanelChange = (panel: string) => (event: React.SyntheticEvent, isExpanded: boolean) => {
        setExpandedPanels({ ...expandedPanels, [panel]: isExpanded });
    };

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
                <button
                    className="btn btn btn-outline"
                    onClick={() => {
                        props.setStateMachineEvent(4);
                        // toggle state transtion after a short delay
                        setTimeout(() => {
                            props.setStateTransitionToggle(!props.stateTransitionToggle);
                        }, 500);
                    }}
                >
                    Reset
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

            <Accordion
                expanded={expandedPanels['agent-response'] !== false}
                onChange={handlePanelChange('agent-response')}
                sx={{
                    background: 'transparent',
                    boxShadow: 'none',
                    '&:before': {
                        display: 'none',
                    }
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                        padding: '0',
                        '& .MuiAccordionSummary-content': {
                            margin: '0',
                        }
                    }}
                >
                    <div className='flex items-center gap-2 py-2'>
                        <div className='text-lg font-bold'>Agent response</div>
                        {props.currentState !== -1 && props.isProcessing &&
                            <span className="loading loading-dots loading-md"></span>}
                    </div>
                </AccordionSummary>
                <AccordionDetails sx={{ padding: '0 0 0px 0' }}>
                    {/* {props.currentState !== -1 ? (
                        <div
                            className="content-block-body"
                            style={{
                                padding: '16px',
                                borderRadius: '8px',
                                backgroundColor: 'rgba(0,0,0,0.03)',
                                whiteSpace: 'pre-line',
                                fontFamily: 'inherit',
                                fontSize: '1rem',
                                lineHeight: '1.5'
                            }}
                        >
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
                        </div>
                    ) : (
                        <div className="text-gray-400 italic px-2">No response available</div>
                    )} */}
                    <TTSPlayer input={ttsInput} />
                </AccordionDetails>
            </Accordion>

            <Accordion
                expanded={expandedPanels['visual-responses']}
                onChange={handlePanelChange('visual-responses')}
                sx={{
                    background: 'transparent',
                    boxShadow: 'none',
                    '&:before': {
                        display: 'none',
                    }
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                        padding: '0',
                        '& .MuiAccordionSummary-content': {
                            margin: '0',
                        }
                    }}
                >
                    <div className='flex items-center gap-2 py-2'>
                        <div className='text-lg font-bold'>Real-time visual agent responses</div>
                        <label
                            className="btn btn-xs btn-outline cursor-pointer"
                            onClick={(e) => {
                                e.stopPropagation();
                                saveResponsesToFileAsync();
                            }}
                        >
                            save
                        </label>
                    </div>
                </AccordionSummary>
                <AccordionDetails sx={{ padding: '0 0 16px 0' }}>
                    <div
                        ref={memoryDivRef}
                        className="content-block-body content-kv"
                        style={{
                            height: '300px',
                            overflowY: 'auto',
                            padding: '10px',
                            borderRadius: '8px',
                            backgroundColor: 'rgba(0,0,0,0.03)'
                        }}
                    >
                        {" [ "}
                        {props.currentState !== -1 && combinedMemory.map((item, idx) => (
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
                </AccordionDetails>
            </Accordion>

            <Accordion
                expanded={expandedPanels['possible-next-events']}
                onChange={handlePanelChange('possible-next-events')}
                sx={{
                    background: 'transparent',
                    boxShadow: 'none',
                    '&:before': {
                        display: 'none',
                    }
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                        padding: '0',
                        '& .MuiAccordionSummary-content': {
                            margin: '0',
                        }
                    }}
                >
                    <div className='text-lg font-bold py-2'>Possible next events</div>
                </AccordionSummary>
                <AccordionDetails sx={{ padding: '0 0 16px 0' }}>
                    {props.currentState !== -1 ? (
                        <ul style={{
                            listStyleType: 'none',
                            padding: 0,
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '0.5rem'
                        }}>
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
                                        className='btn btn-outline btn-xs text-left cursor-pointer'
                                    >
                                        {event}: {eventTranslator[Number(event)]}
                                    </li>
                                ))}
                        </ul>
                    ) : (
                        <div className="text-gray-400 italic px-2">No events available</div>
                    )}
                </AccordionDetails>
            </Accordion>

            <ControlTray
                videoRef={props.videoRef}
                supportsVideo={true}
                currentState={props.currentState}
                videoKnowledgeInput={props.videoKnowledgeInput}
                combinedMemory={combinedMemory}
                onVideoStreamChange={props.setVideoStream}
                setStateMachineEvent={props.setStateMachineEvent}
                setCurrentState={props.setCurrentState}
                connectConversation={connectConversation}
                disconnectConversation={disconnectConversation}
                setVoiceInputTranscript={props.setVoiceInputTranscript}
                setCombinedMemory={setCombinedMemory}
                onDisconnect={saveResponsesToFileAsync}
            />
        </Stack >
    );
}