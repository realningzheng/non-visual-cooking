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
import { LiveConfig, ModelTurn, ServerContent, FunctionDeclaration } from "../multimodal-live-types";
import { AudioStreamer } from "../lib/audio-streamer";
import { audioContext } from "../lib/utils";
import VolMeterWorket from "../lib/worklets/vol-meter";

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

const procedureCheckingFunctionDeclaration: FunctionDeclaration = {
	name: "checkProcedureAlignment",
	description: "Based on the video procedure and user's stream input, determine if the user is following the correct order based on a given image and conversation context.",
	parameters: {
		type: "OBJECT",
		properties: {
			realityImageVideoRelevance: {
				type: "BOOLEAN",
				description: "Return true if the reality image is relevant to the cooking video description.",
			},
			realityImageDescription: {
				type: "STRING",
				description: "A brief description of the current reality image。",
			},
			procedureName: {
				type: "STRING",
				description: "The name of the new procedure that the user is currently following.",
			},
			isNewProcedure: {
				type: "BOOLEAN",
				description: "Return true if the user has started a new procedure different from the last procedure.",
			},
			isCorrectOrder: {
				type: "BOOLEAN",
				description: "Return true if the user is following the correct order based on the given image and conversation context.",
			},
		},
		required: ["realityImageVideoRelevance", "realityImageDescription", "procedureName", "isNewProcedure", "isCorrectOrder"],
	},
};
  
async function setFunctionCallValues(realityImageVideoRelevance: boolean, realityImageDescription: string, procedureName: string, isNewProcedure: boolean, isCorrectOrder: boolean) {
	return {
		"realityImageVideoRelevance": realityImageVideoRelevance,
		"realityImageDescription": realityImageDescription,
		"procedureName": procedureName,
		"isNewProcedure": isNewProcedure,
		"isCorrectOrder": isCorrectOrder,
	};
}
// Define the expected parameter structure
interface CheckProcedureAlignmentParams {
	realityImageVideoRelevance: boolean;
	realityImageDescription: string;
	procedureName: string;
	isNewProcedure: boolean;
	isCorrectOrder: boolean;
}
  
// Define the function map with explicit types
const functions: Record<string, (params: CheckProcedureAlignmentParams) => void> = {
	checkProcedureAlignment: ({
	  realityImageVideoRelevance,
	  realityImageDescription,
	  procedureName,
	  isNewProcedure,
	  isCorrectOrder
	}: CheckProcedureAlignmentParams) => {
	  return setFunctionCallValues(
		realityImageVideoRelevance,
		realityImageDescription,
		procedureName,
		isNewProcedure,
		isCorrectOrder
	  );
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
		tools: [
			{
				functionDeclarations: [procedureCheckingFunctionDeclaration],
			},
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
		console.log(config);
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
