import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';

interface VideoSegmentPlayerProps {
	sourceUrl: string;
	segments: [number, number][]; // Array of tuples representing start and end times
	segmentedVideoPlaying: boolean;
	replaySignal: boolean;
	setPlaySeconds: (seconds: number) => void;
}

const VideoSegmentPlayer: React.FC<VideoSegmentPlayerProps> = (props: VideoSegmentPlayerProps) => {
	const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
	const playerRef = useRef<ReactPlayer>(null);
	const [isClient, setIsClient] = useState(false);

	// set up client state
	useEffect(() => {
		if (typeof window !== 'undefined') {
			setIsClient(true);
		}
	}, []);

	// listen to passive playSeconds change
	useEffect(() => {
		playerRef.current?.seekTo(props.segments[0][0]);
	}, [props.replaySignal]);

	return (
		<div>
			{isClient && (
				<div className="relative pt-[56.25%]"> {/* 16:9 aspect ratio wrapper */}
					<ReactPlayer
						ref={playerRef}
						url={props.sourceUrl}
						playing={props.segmentedVideoPlaying}
						controls
						width="100%"
						height="100%"
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
						}}
						onProgress={({ playedSeconds }) => {
							props.setPlaySeconds(playedSeconds);
							// Ensure playback starts from first segment
							if (playedSeconds < props.segments[0][0]) {
								playerRef.current?.seekTo(props.segments[0][0]);
								return;
							}
							// Stop at final segment end and seek back to the beginning
							if (playedSeconds >= props.segments[props.segments.length - 1][1]) {
								playerRef.current?.getInternalPlayer()?.pause();
								playerRef.current?.seekTo(props.segments[0][0]);
								return;
							}
							// Move to next segment if current segment ended
							if (playedSeconds >= props.segments[currentSegmentIndex][1]) {
								playerRef.current?.seekTo(props.segments[currentSegmentIndex + 1][0]);
								setCurrentSegmentIndex(currentSegmentIndex + 1);
							}
						}}
					/>
				</div>
			)}
		</div>
	);
};

export default VideoSegmentPlayer;
