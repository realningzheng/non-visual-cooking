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
