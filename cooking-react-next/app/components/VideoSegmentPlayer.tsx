import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';

interface VideoSegmentPlayerProps {
	sourceUrl: string;
	segments: [number, number][]; // Array of tuples representing start and end times
	setPlaySeconds: (seconds: number) => void;
}

const VideoSegmentPlayer: React.FC<VideoSegmentPlayerProps> = ({ sourceUrl, segments, setPlaySeconds }) => {
	const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
	const [playing, setPlaying] = useState(false);
	const playerRef = useRef<ReactPlayer>(null);
	const [isClient, setIsClient] = useState(false);

	// set up client state
	useEffect(() => {
		if (typeof window !== 'undefined') {
			setIsClient(true);
		}
	}, []);

	return (
		<div>
			{isClient && (
				<div className="relative pt-[56.25%]"> {/* 16:9 aspect ratio wrapper */}
					<ReactPlayer
						ref={playerRef}
						url={sourceUrl}
						playing={playing}
						controls
						width="100%"
						height="100%"
						style={{
							position: 'absolute',
							top: 0,
							left: 0,
						}}
						onProgress={({ playedSeconds }) => {
							setPlaySeconds(playedSeconds);
							// Ensure playback starts from first segment
							if (playedSeconds < segments[0][0]) {
								playerRef.current?.seekTo(segments[0][0]);
								return;
							}
							// Stop at final segment end
							if (playedSeconds >= segments[segments.length - 1][1]) {
								setPlaying(false);
								playerRef.current?.getInternalPlayer()?.pause();
								return;
							}
							// Move to next segment if current segment ended
							if (playedSeconds >= segments[currentSegmentIndex][1]) {
								playerRef.current?.seekTo(segments[currentSegmentIndex + 1][0]);
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