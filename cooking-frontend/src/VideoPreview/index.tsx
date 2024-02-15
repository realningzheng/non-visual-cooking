import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../reducers';

interface VideoPreviewProps {
    vurl: string;
}

export default function VideoPreview(props: VideoPreviewProps) {
    const videoPlayerRef = useRef<ReactPlayer>(null);
    const isPlaying = useSelector((state: RootState) => state.videoControlReducer.isPlaying);

    return (
        <div
            // className="video-text-overlay-container"
            style={{
                position: "relative",
                width: "100%",
                height: 0,
                paddingTop: '56.25%'
            }}
        >
            <ReactPlayer
                // className="react-player"
                ref={videoPlayerRef}
                url={props.vurl}
                playing={isPlaying}
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                }}
                width={'100%'}
                height={'100%'}
                controls
            />
        </div>
    );
}