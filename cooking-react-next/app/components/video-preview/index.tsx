"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import { Stack, Box, Typography } from '@mui/material';

interface VideoPreviewProps {
    vurl: string;
    isVideoPlaying: boolean;
    setIsVideoPlaying: (isVideoPlaying: boolean) => void;
}

export default function VideoPreview(props: VideoPreviewProps) {
    const videoPlayerRef = useRef<ReactPlayer>(null);
    const [isClient, setIsClient] = useState(false);

    // set up client state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);

    return (
        <Stack spacing={2} justifyContent={'center'} width={'100%'}>
            <div
                id='raw-video-preview'
                style={{
                    position: "relative",
                    width: "100%",
                    height: 0,
                    paddingTop: '56.25%'
                }}
            >
                {isClient &&
                    <ReactPlayer
                        ref={videoPlayerRef}
                        url={props.vurl}
                        playing={props.isVideoPlaying}
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
                }
            </div>
        </Stack>
    );
}