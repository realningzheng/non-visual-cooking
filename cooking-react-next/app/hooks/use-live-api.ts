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
				description: "Indicates if current scene shows a valid cooking step from reference knowledge. " +
					"TRUE: User performing recognizable cooking step (e.g., 'chopping onions', 'stirring sauce'). " +
					"FALSE: Non-cooking activities (e.g., walking, checking phone) or unclear/ambiguous actions.",
			},
			isStepCorrect: {
				type: SchemaType.BOOLEAN,
				description: "Indicates if the current step is executed correctly. " +
					"TRUE: Execution matches reference exactly. " +
					"FALSE: Execution deviates from reference (e.g., 'Heat too high causing rapid browning', " +
					"'Cutting size inconsistent, ranging from 1/4 to 1/2 inch pieces').",
			},
			isCorrectProcedureOrder: {
				type: SchemaType.BOOLEAN,
				description: "As the user has moved to the next procedure, indicates if the user is following the correct order according to the video knowledge. " +
					"TRUE: The new step's order is correct. " +
					"FALSE: User is not following the right procedure.",
			},
			hasProgressedToProcedure: {
				type: SchemaType.BOOLEAN,
				description: "Indicates if user has completed all steps in current procedure and moved to next procedure. " +
					"TRUE: Current procedure complete and new procedure started. " +
					"FALSE: Still working on current procedure or between steps of same procedure.",
			},
			procedureAnalysis: {
				type: SchemaType.STRING,
				description: "The high-level cooking procedure being performed at the current time based on the reality image. " + 
					"This should be in one of the procedures in the correct procedure sequence in the prompt.",
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
				description: "Should only be provided if the user is doing the step wrong or not following the procedure correctly. " +
					"Clear, actionable guidance when issues found, based on reference knowledge. " +
					"Include what to correct, how to correct it, and why it matters. " +
					"Empty string if no issues found. " +
					"Example: 'Reduce heat to medium-high - current temperature is too hot and will burn the exterior " +
					"before the chicken is cooked through. Wait 30 seconds before adding the meat.'",
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

	useEffect(() => {
		const onClose = () => {
			setConnected(false);
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
			client
				.off("close", onClose)
				.off("interrupted", onInterrupted)
				.off("audio", onAudio)
				.off("content", onContent)
				.off("turncomplete", onTurnComplete)
				.off("turnnotcomplete", onTurnNotComplete);
		};
	}, [client]);

	const connect = useCallback(async () => {
		if (!config) {
			throw new Error("config has not been set");
		}
		client.disconnect();
		await client.connect(config);
		setConnected(true);
	}, [client, setConnected, config]);

	const disconnect = useCallback(async () => {
		client.disconnect();
		setConnected(false);
	}, [setConnected, client]);

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
