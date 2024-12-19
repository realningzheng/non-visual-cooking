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

import cn from "classnames";
import { BiMicrophone, BiMicrophoneOff, BiPlay, BiPause, BiDesktop, BiStopCircle, BiVideo, BiVideoOff } from 'react-icons/bi';

import { memo, ReactNode, RefObject, useEffect, useRef, useState } from "react";
import { useEventDetectionContext } from "../../contexts/EventDetectionContext";
import { useMultimodalStateContext } from "../../contexts/MultimodalStateContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import { systemPromptEventDetection, systemPromptDefault } from "../../prompt";
import { getPromptForPossibleNextEvents } from "../../WorkFlow/stateMachine";


export type ControlTrayProps = {
	videoRef: RefObject<HTMLVideoElement>;
	children?: ReactNode;
	supportsVideo: boolean;
	currentState: number;
	onVideoStreamChange?: (stream: MediaStream | null) => void;
	setStateMachineEvent: (event: number) => void;
	setCurrentState: (state: number) => void;
};

type MediaStreamButtonProps = {
	isStreaming: boolean;
	onIcon: string;
	offIcon: string;
	start: () => Promise<any>;
	stop: () => any;
};


function ControlTray(props: ControlTrayProps) {
	const videoStreams = [useWebcam(), useScreenCapture()];
	const [activeVideoStream, setActiveVideoStream] =
		useState<MediaStream | null>(null);
	const [webcam, screenCapture] = videoStreams;
	const [inVolume, setInVolume] = useState(0);
	const [audioRecorder] = useState(() => new AudioRecorder());
	const [muted, setMuted] = useState(false);
	const renderCanvasRef = useRef<HTMLCanvasElement>(null);
	const connectButtonRef = useRef<HTMLButtonElement>(null);
	const audioChunks = useRef<string[]>([]);

	// const {
	// 	client: eventClient,
	// 	connected: eventConnected,
	// 	connect: eventConnect,
	// 	disconnect: eventDisconnect,
	// 	volume: eventVolume,
	// 	setConfig: eventSetConfig,
	// 	config: eventConfig,
	// 	turnComplete: eventTurnComplete
	// } = useEventDetectionContext();

	const {
		client: multimodalClient,
		connected: multimodalConnected,
		connect: multimodalConnect,
		disconnect: multimodalDisconnect,
		volume: multimodalVolume,
		setConfig: multimodalSetConfig,
		config: multimodalConfig
	} = useMultimodalStateContext();


	/** Configure event detection session client, response with text only */
	// useEffect(() => {
	// 	eventSetConfig({
	// 		...eventConfig,
	// 		generationConfig: {
	// 			responseModalities: "text"
	// 		},
	// 		systemInstruction: {
	// 			parts: [
	// 				{
	// 					text: systemPromptEventDetection,
	// 				},
	// 			],
	// 		},
	// 	});
	// }, [eventSetConfig]);


	/** Configure multimodal session client, response with audio */
	useEffect(() => {
		multimodalSetConfig({
			...multimodalConfig,
			generationConfig: {
				responseModalities: "audio"
			},
			systemInstruction: {
				parts: [
					{
						text: systemPromptDefault,
					},
				],
			},
		});
	}, [multimodalSetConfig]);


	useEffect(() => {
		document.documentElement.style.setProperty(
			"--volume",
			`${Math.max(5, Math.min(inVolume * 200, 8))}px`,
		);
	}, [inVolume]);


	/** Send real time audio to event detection client */
	// useEffect(() => {
	// 	const onData = (base64: string) => {
	// 		eventClient.sendRealtimeInput([
	// 			{
	// 				mimeType: "audio/pcm;rate=16000",
	// 				data: base64,
	// 			},
	// 		]);
	// 		audioChunks.current.push(base64);
	// 	};
	// 	if (eventConnected && !muted && audioRecorder) {
	// 		audioRecorder.on("data", onData).on("volume", setInVolume).start();
	// 	} else {
	// 		audioRecorder.stop();
	// 	}
	// 	return () => {
	// 		audioRecorder.off("data", onData).off("volume", setInVolume);
	// 	};
	// }, [eventConnected, eventClient, muted, audioRecorder]);


	/** Send real time audio to multimodal state client */
	useEffect(() => {
		const onData = (base64: string) => {
			multimodalClient.sendRealtimeInput([
				{
					mimeType: "audio/pcm;rate=16000",
					data: base64,
				},
			]);
			audioChunks.current.push(base64);
		};
		if (multimodalConnected && !muted && audioRecorder) {
			audioRecorder.on("data", onData).on("volume", setInVolume).start();
		} else {
			audioRecorder.stop();
		}
		return () => {
			audioRecorder.off("data", onData).off("volume", setInVolume);
		};
	}, [multimodalConnected, multimodalClient, muted, audioRecorder]);


	/** Handle turn completion and sending data */
	// useEffect(() => {
	// 	if (eventTurnComplete && audioChunks.current.length > 0) {
	// 		try {
	// 			if (audioChunks.current.length > 0) {
	// 				console.log('[Sending audio data]');
	// 			}
	// 			// Send a 1-second audio chunk with very quiet random noise to signal end of stream
	// 			const samples = 8000; // 1 second at 16kHz
	// 			const buffer = new Int16Array(samples);
	// 			for (let i = 0; i < samples; i++) {
	// 				// Random values between -50 and 50 (very quiet compared to 16-bit range of -32768 to 32767)
	// 				buffer[i] = Math.floor(Math.random() * 100 - 50);
	// 			}
	// 			const base64EmptyChunk = btoa(String.fromCharCode(...new Uint8Array(buffer.buffer)));
	// 			multimodalClient.sendRealtimeInput([{
	// 				mimeType: "audio/pcm;rate=16000",
	// 				data: base64EmptyChunk
	// 			}]);

	// 			// Send each chunk as a separate input
	// 			for (const chunk of audioChunks.current) {
	// 				multimodalClient.sendRealtimeInput([{
	// 					mimeType: "audio/pcm;rate=16000",
	// 					data: chunk
	// 				}]);
	// 			}

	// 			multimodalClient.sendRealtimeInput([{
	// 				mimeType: "audio/pcm;rate=16000",
	// 				data: base64EmptyChunk
	// 			}]);
	// 		} catch (e) {
	// 			console.error('[Error sending audio data]', e);
	// 		} finally {
	// 			audioChunks.current = [];
	// 			console.log('[Cache cleared]');
	// 		}
	// 	}
	// }, [eventTurnComplete, multimodalClient]);


	/** This hook frequently sends video frames to the multimodal state client */
	useEffect(() => {
		if (props.videoRef.current) {
			props.videoRef.current.srcObject = activeVideoStream;
		}

		let timeoutId = -1;

		function sendVideoFrame() {
			const video = props.videoRef.current;
			const canvas = renderCanvasRef.current;

			if (!video || !canvas || !activeVideoStream) {
				return;
			}

			const ctx = canvas.getContext("2d")!;
			canvas.width = video.videoWidth * 0.25;
			canvas.height = video.videoHeight * 0.25;
			if (canvas.width + canvas.height > 0) {
				ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
				const base64 = canvas.toDataURL("image/jpeg", 1.0);
				const data = base64.slice(base64.indexOf(",") + 1, Infinity);
				console.log('send visuals')
				multimodalClient.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
			}
			if (multimodalConnected) {
				timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
			}
		}
		if (multimodalConnected && activeVideoStream !== null) {
			requestAnimationFrame(sendVideoFrame);
		}
		return () => {
			clearTimeout(timeoutId);
		};
	}, [multimodalConnected, activeVideoStream, multimodalClient, props.videoRef]);


	//handler for swapping from one video-stream to the next
	const changeStreams = (next?: UseMediaStreamResult) => async () => {
		if (next) {
			const mediaStream = await next.start();
			setActiveVideoStream(mediaStream);
			props.onVideoStreamChange?.(mediaStream);
		} else {
			setActiveVideoStream(null);
			props.onVideoStreamChange?.(null);
		}

		videoStreams.filter((msr) => msr !== next).forEach((msr) => msr.stop());
	};


	/** Connect to conversation */
	const connectConversation = async () => {
		// Clear any existing audio chunks when starting a new connection
		audioChunks.current = [];
		// await eventConnect();
		await multimodalConnect();
		props.setStateMachineEvent(20);
		props.setCurrentState(0);
	};


	/* Disconnect and reset conversation state */
	const disconnectConversation = async () => {
		// await eventDisconnect();
		await multimodalDisconnect();
		props.setStateMachineEvent(-1);
		props.setCurrentState(-1);
	};


	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-base-200 rounded-full shadow-lg px-6 py-3">
			<canvas className="hidden" ref={renderCanvasRef} />
			<div className="flex items-center gap-2">
				<div className={cn("flex items-center gap-2", { "opacity-50": !multimodalConnected })}>
					<button
						className={cn("btn btn-sm btn-circle", {
							"btn-error": !muted && multimodalConnected,
							"btn-ghost": muted
						})}
						onClick={() => setMuted(!muted)}
					>
						{!muted ? <BiMicrophone size={16} /> : <BiMicrophoneOff size={16} />}
					</button>

					<div className="btn btn-sm btn-circle btn-ghost no-animation">
						<AudioPulse volume={multimodalVolume} active={multimodalConnected} hover={false} />
					</div>

					{props.supportsVideo && (
						<>
							<button
								className={cn("btn btn-sm btn-circle", {
									"btn-neutral": screenCapture.isStreaming,
									"btn-ghost": !screenCapture.isStreaming
								})}
								onClick={screenCapture.isStreaming ? changeStreams() : changeStreams(screenCapture)}
							>
								{screenCapture.isStreaming ? <BiStopCircle size={16} /> : <BiDesktop size={16} />}
							</button>
							<button
								className={cn("btn btn-sm btn-circle", {
									"btn-neutral": webcam.isStreaming,
									"btn-ghost": !webcam.isStreaming
								})}
								onClick={webcam.isStreaming ? changeStreams() : changeStreams(webcam)}
							>
								{webcam.isStreaming ? <BiVideoOff size={16} /> : <BiVideo size={16} />}
							</button>
						</>
					)}
					{props.children}
				</div>

				<div className="flex items-center gap-2 ml-2 pl-2 border-l border-base-300">
					<button
						ref={connectButtonRef}
						className={cn("btn btn-sm btn-circle", {
							"btn-neutral": multimodalConnected,
							"btn-ghost": !multimodalConnected
						})}
						onClick={multimodalConnected ? disconnectConversation : connectConversation}
					>
						{multimodalConnected ? <BiPause size={16} /> : <BiPlay size={16} />}
					</button>
				</div>
			</div>
		</div>
	);
}

export default memo(ControlTray);
