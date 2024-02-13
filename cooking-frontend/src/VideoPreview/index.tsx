import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import './style.css';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../reducers';

interface VideoPreviewProps {
    vurl: string;
}

export default function VideoPreview(props: VideoPreviewProps) {
    const videoPlayerRef = useRef<ReactPlayer>(null);
    const isPlaying = useSelector((state: RootState) => state.videoControlReducer.isPlaying);

    return (
        <div className="video-text-overlay-container">
            <ReactPlayer
                className="react-player"
                ref={videoPlayerRef}
                url={props.vurl}
                playing={isPlaying}
                controls
            />
        </div>
    );
}