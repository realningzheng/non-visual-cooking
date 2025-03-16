/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	MultimodalLiveAPIClientConnection,
	MultimodalLiveClient,
} from "../lib/multimodal-live-client";
import { LiveConfig, ModelTurn, ServerContent } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";

export type UseLiveAPIResults = {
	client: MultimodalLiveClient;
	setConfig: (config: LiveConfig) => void;
	config: LiveConfig;
	connected: boolean;
	connect: () => Promise<void>;
	disconnect: () => Promise<void>;
	volume: number;
	content: string;
	turnComplete: boolean;
};

export const compareStreamWithReferenceVideoKnowledge: FunctionDeclaration = {
	name: "compareStreamWithReferenceVideoKnowledge",
	description: "Analyzes live cooking video stream by comparing against reference cooking knowledge set in the system context. " +
		"Also decide if user is following correct procedure (high-level activities like 'Preparing Burger Sauce') sequence, and making any mistakes in steps (specific actions like 'Mixing mayonnaise with chopped pickles'). " +
		"Also analyze the procedure, steps, sound, and cooking items in the current scene and compare them to the reference knowledge. " +
		"Return the results in a JSON object.",
	parameters: {
		type: SchemaType.OBJECT,
		properties: {
			isValidCookingStep: {
				type: SchemaType.BOOLEAN,
				description: "Is this a valid cooking activity from the reference? " +
					"TRUE: Recognizable cooking step matching reference (e.g., 'chopping onions', 'stirring sauce'). " +
					"FALSE: Non-cooking activity or unrecognizable action (e.g., walking, looking at somewhere else).",
			},
			isStepCorrect: {
				type: SchemaType.BOOLEAN,
				description: "Is the current step being executed properly based on the real-time video stream and reference cooking knowledge? " +
					"TRUE: The audiovisual information of the current scene matches reference knowledge. " +
					"FALSE: Execution deviates from reference (e.g., 'Heat too high causing rapid browning', " +
                    "'Cutting size inconsistent, ranging from 1/4 to 1/2 inch pieces').",
			},
			isCorrectProcedureOrder: {
				type: SchemaType.BOOLEAN,
				description: "Is the user following procedures in the correct sequence? " +
					"TRUE: Current procedure follows the proper sequence. " +
					"FALSE: User has skipped procedures or is performing a step in a wrong order.",
			},
			hasProgressedToProcedure: {
				type: SchemaType.BOOLEAN,
				description: "Has the user completed the previous procedure and moved to a new one? " +
					"TRUE: User has transitioned to a new procedure. " +
					"FALSE: Still working within the same procedure as previous observation.",
			},
			procedureAnalysis: {
				type: SchemaType.STRING,
				description: "The specific high-level cooking procedure currently being performed. " + 
					"Should match one of the reference procedures exactly.",
			},
			stepAnalysis: {
				type: SchemaType.STRING,
				description: "Precise description of the current step being performed within the current procedure. " +
					"Examples: 'Mixing mayonnaise with chopped pickles', 'Forming ground beef into 4-ounce patties', " +
					"'Toasting burger buns until golden brown'. Must match step descriptions from reference.",
			},
			foodAndKitchenwareAnalysis: {
				type: SchemaType.STRING,
				description: "Detailed description of visible food, ingredients, kitchenware and their states. Include: " +
					"1. Ingredients and their conditions (e.g., 'finely diced onions', 'golden-brown chicken') " +
					"2. Tools and their current use (e.g., 'pan heating with oil', 'knife on cutting board') " +
					"3. Spatial relationships (e.g., 'ingredients arranged mise en place', 'meat nestled in sauce') " +
					"Example: 'Diced onions and minced garlic on wooden cutting board', 'raw chicken thighs on paper towels', " +
					"'large skillet heating on medium-high with shimmering oil', 'half chicken with skin upside and cooked crispy on a pan'",
			},
			audioAnalysis: {
				type: SchemaType.STRING,
				description: "Description of cooking-related sounds in the scene. Focus on kitchen sounds, not voices. " +
					"Include intensity and characteristics of sounds. " +
					"Examples: 'Loud sizzling from meat hitting hot pan', 'Gentle bubbling of simmering sauce', " +
					"'Rhythmic chopping sound on cutting board', 'Quiet whirring of food processor'",
			},
			improvementInstructions: {
				type: SchemaType.STRING,
				description: "Precisely describe the issues detected and provide instructions on how to correct them immediately. Include: " +
					"• What specifically is incorrect " +
					"• How to correct it immediately "
			}
		},
		required: [
			"isValidCookingStep",
			"isStepCorrect",
			"isCorrectProcedureOrder",
			"hasProgressedToProcedure",
			"procedureAnalysis",
			"stepAnalysis",
			"foodAndKitchenwareAnalysis",
			"audioAnalysis",
			"improvementInstructions"
		]
	}
};

export function useLiveAPI({
	url,
	apiKey,
}: MultimodalLiveAPIClientConnection): UseLiveAPIResults {
	const client = useMemo(
		() => new MultimodalLiveClient({ url, apiKey }),
		[url, apiKey],
	);
	const audioStreamerRef = useRef<AudioStreamer | null>(null);
	const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isReconnectingRef = useRef(false);

	const [connected, setConnected] = useState(false);
	const [config, setConfig] = useState<LiveConfig>({
		model: "models/gemini-2.0-flash-exp",
		generationConfig: {
			responseMimeType: "application/json",
		},
		tools: [
			// { googleSearch: {} },
			{ functionDeclarations: [compareStreamWithReferenceVideoKnowledge] },
		],
	});

	const [volume, setVolume] = useState(0);
	const [content, setContent] = useState("");
	const [turnComplete, setTurnComplete] = useState(false);
	
	// register audio for streaming server -> speakers
	useEffect(() => {
		if (!audioStreamerRef.current) {
			audioContext({ id: "audio-out" }).then((audioCtx: AudioContext) => {
				audioStreamerRef.current = new AudioStreamer(audioCtx);
				audioStreamerRef.current
					.addWorklet<any>("vumeter-out", VolMeterWorket, (ev: any) => {
						setVolume(ev.data.volume);
					})
					.then(() => {
						// Successfully added worklet
					});
			});
		}
	}, [audioStreamerRef]);

	const connect = useCallback(async () => {
		if (!config) {
			throw new Error("config has not been set");
		}
		
		// Clear any existing reconnect timeout
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		
		client.disconnect();
		await client.connect(config);
		setConnected(true);
	}, [client, setConnected, config]);

	const disconnect = useCallback(async () => {
		// Clear any existing reconnect timeout
		if (reconnectTimeoutRef.current) {
			clearTimeout(reconnectTimeoutRef.current);
			reconnectTimeoutRef.current = null;
		}
		
		client.disconnect();
		setConnected(false);
	}, [setConnected, client]);

	useEffect(() => {
		const onClose = (event: CloseEvent) => {
			setConnected(false);
			
			// Check if the close was due to exceeding time limit
			const reason = event.reason || "";
			const isTimeoutError = 
				reason.toLowerCase().includes("time limit") || 
				reason.toLowerCase().includes("timeout") ||
				reason.toLowerCase().includes("deadline_exceeded");
			
			// If it was a timeout error, attempt to reconnect
			if (isTimeoutError) {
				console.log("WebSocket closed due to time limit, attempting to reconnect...");
				
				// Set the reconnecting flag
				isReconnectingRef.current = true;
				
				// Clear any existing reconnect timeout
				if (reconnectTimeoutRef.current) {
					clearTimeout(reconnectTimeoutRef.current);
				}
				
				console.log("Setting up reconnection timeout...");
				
				// Set a timeout to reconnect after a short delay (2 seconds)
				reconnectTimeoutRef.current = setTimeout(() => {
					console.log("Reconnection timeout triggered, attempting to reconnect...");
					
					connect().then(() => {
						console.log("Successfully reconnected to WebSocket");
						isReconnectingRef.current = false;
					}).catch((error) => {
						console.error("Failed to reconnect to WebSocket:", error);
						isReconnectingRef.current = false;
					});
				}, 2000);
				
				console.log("Reconnection timeout set:", reconnectTimeoutRef.current);
			}
		};

		const onInterrupted = () => {
			audioStreamerRef.current?.stop();
		}

		const onAudio = (data: ArrayBuffer) =>
			audioStreamerRef.current?.addPCM16(new Uint8Array(data));

		const onContent = (data: ServerContent) => {
			if ('modelTurn' in data) {  // Type guard
				const newContent = data.modelTurn.parts
					.filter((part: any) => part.text)
					.map((part: any) => part.text)
					.join('');
				setContent(newContent);
			}
		}

		const onTurnComplete = () => {
			setTurnComplete(true);
		}

		const onTurnNotComplete = () => {
			setTurnComplete(false);
		}

		client
			.on("close", onClose)
			.on("interrupted", onInterrupted)
			.on("audio", onAudio)
			.on("content", onContent)
			.on("turncomplete", onTurnComplete)
			.on("turnnotcomplete", onTurnNotComplete)

		return () => {
			// Only clear the timeout if we're not in the process of reconnecting
			if (reconnectTimeoutRef.current && !isReconnectingRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
				reconnectTimeoutRef.current = null;
			}
			
			client
				.off("close", onClose)
				.off("interrupted", onInterrupted)
				.off("audio", onAudio)
				.off("content", onContent)
				.off("turncomplete", onTurnComplete)
				.off("turnnotcomplete", onTurnNotComplete);
		};
	}, [client]);

	return {
		client,
		config,
		setConfig,
		connected,
		connect,
		disconnect,
		volume,
		content,
		turnComplete,
	};
}
