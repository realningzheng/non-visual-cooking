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
import { BiMicrophone, BiMicrophoneOff, BiPlay, BiPause, BiDesktop, BiStopCircle, BiVideo, BiVideoOff, BiFilm } from 'react-icons/bi';

import { memo, ReactNode, RefObject, useEffect, useRef, useState } from "react";
// import { useEventDetectionContext } from "../../contexts/EventDetectionContext";
// import { useMultimodalStateContext } from "../../contexts/MultimodalStateContext";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import { systemPromptEventDetection, systemPromptDefault } from "../../prompt";
import { ToolCall } from "../../multimodal-live-types";
// import { getPromptForPossibleNextEvents } from "../../WorkFlow/stateMachine";
import { compareStreamWithReferenceVideoKnowledge } from "@/app/hooks/use-live-api";
import { set } from "lodash";

export type ControlTrayProps = {
	videoRef: RefObject<HTMLVideoElement>;
	children?: ReactNode;
	supportsVideo: boolean;
	currentState: number;
	rtTriggerAudio: string;
	onVideoStreamChange?: (stream: MediaStream | null) => void;
	setStateMachineEvent: (event: number) => void;
	setCurrentState: (state: number) => void;
	connectConversation: () => Promise<void>;
	disconnectConversation: () => Promise<void>;
	videoKnowledgeInput: string;
	setFunctionCallResponses: (response: any) => void;
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

	const [videoFile, setVideoFile] = useState<File | null>(null);	// video input (for testing)
	const videoURL = useRef<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const updateFunctionCallResponses = (response: any) => {
		props.setFunctionCallResponses((prevResponses: any[]) => {
			const updatedResponses = [...prevResponses, response];
			console.log('Updated functionCallResponses:', updatedResponses); // Logs correct value
			return updatedResponses;
		});
	};


	const handleVideoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (file && file.type === "video/mp4") {
			// Revoke previous object URL to free memory
			if (videoURL.current) {
				URL.revokeObjectURL(videoURL.current);
			}

			videoURL.current = URL.createObjectURL(file);
			setVideoFile(file);
		} else {
			alert("Please upload an MP4 video file.");
		}
	};

	const triggerFileUpload = () => {
		fileInputRef.current?.click();
	};


	useEffect(() => {
		if (videoFile && props.videoRef.current) {
			props.videoRef.current.src = URL.createObjectURL(videoFile);
			props.videoRef.current.load();
			props.videoRef.current.play();
		}
	}, [videoFile]);


	const {
		client: liveAPIClient,
		connected: liveAPIConnected,
		connect: liveAPIConnect,
		disconnect: liveAPIDisconnect,
		volume: liveAPIVolume,
		setConfig: liveAPISetConfig,
		config: liveAPIConfig
	} = useLiveAPIContext();


	/** Configure multimodal session client, response with audio */
	useEffect(() => {
		liveAPISetConfig({
			...liveAPIConfig,
			generationConfig: {
				...liveAPIConfig.generationConfig,
				responseModalities: "text"
			},
			systemInstruction: {
				parts: [{
					text: `You are an AI cooking assistant analyzing real-time cooking procedures from a video stream. 
					Your high-levelgoal is to analyze the current video stream and compare it with the reference cooking knowledge in the system context given after <VIDEO KNOWLEDGE>.
					<VIDEO KNOWLEDGE>
					${props.videoKnowledgeInput}

					ROLE:
					- Monitor cooking activities in real-time video stream
					- Compare against reference cooking knowledge
					- Identify deviations from correct procedures
					- Provide immediate, actionable feedback

					RESPONSE GUIDELINES:
					- Be precise and concise
					- Prioritize critical safety and quality issues
					- Consider both visual and audio inputs

					User will also provided previous responses from you as context after <Previous observations for context>
					`
				}]
			}
		});
		console.log('liveAPIConfig', liveAPIConfig)
	}, [liveAPISetConfig]);

	useEffect(() => {
		const onToolCall = (toolCall: ToolCall) => {
			console.log(`got toolcall`, toolCall);
			const fc = toolCall.functionCalls.find(
				(fc) => fc.name === compareStreamWithReferenceVideoKnowledge.name,
			);
			if (fc) {
				updateFunctionCallResponses(fc.args);
			}
		};

		liveAPIClient.on("toolcall", onToolCall);
		return () => {
			liveAPIClient.off("toolcall", onToolCall);
		};
	}, [liveAPIClient]);

	useEffect(() => {
		document.documentElement.style.setProperty(
			"--volume",
			`${Math.max(5, Math.min(inVolume * 200, 8))}px`,
		);
	}, [inVolume]);


	/** Send real time audio to multimodal state client */
	// @TODO
	useEffect(() => {
		const onData = (base64: string) => {
			liveAPIClient.sendRealtimeInput([
				{
					mimeType: "audio/pcm;rate=16000",
					data: base64,
				},
			]);
			audioChunks.current.push(base64);
		};
		if (liveAPIConnected && !muted && audioRecorder) {
			audioRecorder.on("data", onData).on("volume", setInVolume).start();
		} else {
			audioRecorder.stop();
		}
		return () => {
			audioRecorder.off("data", onData).off("volume", setInVolume);
		};
	}, [liveAPIConnected, liveAPIClient, muted, audioRecorder]);

	// Function to send video frame
	function sendVideoFrame() {
		const video = props.videoRef.current;
		const canvas = renderCanvasRef.current;

		// if (!video || !canvas || !activeVideoStream) {
		// 	return;
		// }
		if (!video || !canvas || (!activeVideoStream && (video.paused || video.ended))) {
			return;
		}

		const ctx = canvas.getContext("2d")!;
		canvas.width = video.videoWidth * 0.25;
		canvas.height = video.videoHeight * 0.25;
		if (canvas.width + canvas.height > 0) {
			console.log('send video frame')
			ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
			const base64 = canvas.toDataURL("image/jpeg", 1.0);
			const data = base64.slice(base64.indexOf(",") + 1, Infinity);
			liveAPIClient.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
		}
		if (liveAPIConnected) {
			window.setTimeout(sendVideoFrame, 1000 / 0.5);
			// videoTimeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
		}
	}

	/** This hook frequently sends video frames to the multimodal state client */
	useEffect(() => {
		if (props.videoRef.current) {
			props.videoRef.current.srcObject = activeVideoStream;
		}

		// Start both video and audio sending if connected
		if (liveAPIConnected) {
			if (activeVideoStream !== null) {
				requestAnimationFrame(sendVideoFrame);
				// requestAnimationFrame(sendAudioData);
			}
		}
	}, [liveAPIConnected, activeVideoStream, liveAPIClient, props.videoRef, muted]);


	useEffect(() => {
		const video = props.videoRef.current;

		if (!video) return;

		const startSendingFrames = () => {
			console.log("Video started playing");
			sendVideoFrame(); // Start capturing frames
		};

		video.addEventListener("play", startSendingFrames);

		return () => {
			video.removeEventListener("play", startSendingFrames);
		};
	}, [props.videoRef, liveAPIConnected]);

	
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
		await liveAPIConnect();
		await props.connectConversation();
		props.setStateMachineEvent(20);
		props.setCurrentState(0);
	};


	/* Disconnect and reset conversation state */
	const disconnectConversation = async () => {
		// await eventDisconnect();
		await liveAPIDisconnect();
		await props.disconnectConversation();
		props.setStateMachineEvent(-1);
		props.setCurrentState(-1);
	};


	return (
		<div>
			<div className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-base-200 shadow-lg px-4 py-2 rounded-lg flex flex-col items-center">
				<video ref={props.videoRef} controls width="200" className="rounded-md shadow-md" />
			</div>
			<div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-base-200 rounded-full shadow-lg px-6 py-3">
				<canvas className="hidden" ref={renderCanvasRef} />
				<div className="flex items-center gap-2">
					<div className={cn("flex items-center gap-2", { "opacity-50": !liveAPIConnected })}>
						<button
							className={cn("btn btn-sm btn-circle", {
								"btn-error": !muted && liveAPIConnected,
								"btn-ghost": muted
							})}
							onClick={() => setMuted(!muted)}
						>
							{!muted ? <BiMicrophone size={16} /> : <BiMicrophoneOff size={16} />}
						</button>

						<div className="btn btn-sm btn-circle btn-ghost no-animation">
							<AudioPulse volume={liveAPIVolume} active={liveAPIConnected} hover={false} />
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
								<button
									className={cn("btn btn-sm btn-circle", {
										"btn-success": videoFile !== null,
										"btn-ghost": videoFile === null
									})}
									onClick={triggerFileUpload}
								>
									<BiFilm size={16} />
								</button>
							</>
						)}
						{props.children}
					</div>

					<div className="flex items-center gap-2 ml-2 pl-2 border-l border-base-300">
						<button
							ref={connectButtonRef}
							className={cn("btn btn-sm btn-circle", {
								"btn-neutral": liveAPIConnected,
								"btn-ghost": !liveAPIConnected
							})}
							onClick={liveAPIConnected ? disconnectConversation : connectConversation}
						>
							{liveAPIConnected ? <BiPause size={16} /> : <BiPlay size={16} />}
						</button>
					</div>
				</div>
			</div>
			<input
				type="file"
				ref={fileInputRef}
				onChange={handleVideoFileUpload}
				accept="video/mp4"
				className="hidden"
			/>
		</div>
	);
}

export default memo(ControlTray);
