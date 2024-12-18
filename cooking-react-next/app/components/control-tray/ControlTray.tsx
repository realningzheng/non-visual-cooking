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
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";
import { useScreenCapture } from "../../hooks/use-screen-capture";
import { useWebcam } from "../../hooks/use-webcam";
import { AudioRecorder } from "../../lib/audio-recorder";
import AudioPulse from "../audio-pulse/AudioPulse";
import { systemPromptEventDetection } from "../../prompt";
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

/**
 * button used for triggering webcam or screen-capture
 */
const MediaStreamButton = memo(
	({ isStreaming, onIcon, offIcon, start, stop }: MediaStreamButtonProps) =>
		isStreaming ? (
			<button className="action-button" onClick={stop}>
				<span className="material-symbols-outlined">{onIcon}</span>
			</button>
		) : (
			<button className="action-button" onClick={start}>
				<span className="material-symbols-outlined">{offIcon}</span>
			</button>
		),
);

function ControlTray(props: ControlTrayProps) {
	const videoStreams = [useWebcam(), useScreenCapture()];
	const [activeVideoStream, setActiveVideoStream] =
		useState<MediaStream | null>(null);
	const [webcam, screenCapture] = videoStreams;
	const [inVolume, setInVolume] = useState(0);
	const [audioRecorder] = useState(() => new AudioRecorder());
	const [muted, setMuted] = useState(true);
	const renderCanvasRef = useRef<HTMLCanvasElement>(null);
	const connectButtonRef = useRef<HTMLButtonElement>(null);

	const { client, connected, connect, disconnect, volume, setConfig, config } =
		useLiveAPIContext();

	useEffect(() => {
		setConfig({
			...config,
			generationConfig: {
				responseModalities: "text"
			},
			systemInstruction: {
				parts: [
					{
						text: systemPromptEventDetection,
					},
				],
			},
		});
	}, [setConfig]);


	useEffect(() => {
		if (!connected && connectButtonRef.current) {
			connectButtonRef.current.focus();
		}
	}, [connected]);


	useEffect(() => {
		document.documentElement.style.setProperty(
			"--volume",
			`${Math.max(5, Math.min(inVolume * 200, 8))}px`,
		);
	}, [inVolume]);


	useEffect(() => {
		const onData = (base64: string) => {
			client.sendRealtimeInput([
				{
					mimeType: "audio/pcm;rate=16000",
					data: base64,
				},
			]);
		};
		if (connected && !muted && audioRecorder) {
			audioRecorder.on("data", onData).on("volume", setInVolume).start();
		} else {
			audioRecorder.stop();
		}
		return () => {
			audioRecorder.off("data", onData).off("volume", setInVolume);
		};
	}, [connected, client, muted, audioRecorder]);


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
				client.sendRealtimeInput([{ mimeType: "image/jpeg", data }]);
			}
			if (connected) {
				timeoutId = window.setTimeout(sendVideoFrame, 1000 / 0.5);
			}
		}
		if (connected && activeVideoStream !== null) {
			requestAnimationFrame(sendVideoFrame);
		}
		return () => {
			clearTimeout(timeoutId);
		};
	}, [connected, activeVideoStream, client, props.videoRef]);


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
		await connect();
		props.setStateMachineEvent(20);
		props.setCurrentState(0);
	};


	/* Disconnect and reset conversation state */
	const disconnectConversation = async () => {
		await disconnect();
		props.setStateMachineEvent(-1);
		props.setCurrentState(-1);
	};


	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-base-200 rounded-full shadow-lg px-6 py-3">
			<canvas className="hidden" ref={renderCanvasRef} />
			<div className="flex items-center gap-2">
				<div className={cn("flex items-center gap-2", { "opacity-50": !connected })}>
					<button
						className={cn("btn btn-sm btn-circle", {
							"btn-error": !muted && connected,
							"btn-ghost": muted
						})}
						onClick={() => setMuted(!muted)}
					>
						{!muted ? <BiMicrophone size={16} /> : <BiMicrophoneOff size={16} />}
					</button>

					<div className="btn btn-sm btn-circle btn-ghost no-animation">
						<AudioPulse volume={volume} active={connected} hover={false} />
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
							"btn-neutral": connected,
							"btn-ghost": !connected
						})}
						onClick={connected ? disconnectConversation : connectConversation}
					>
						{connected ? <BiPause size={16} /> : <BiPlay size={16} />}
					</button>
				</div>
			</div>
		</div>
	);
}

export default memo(ControlTray);
