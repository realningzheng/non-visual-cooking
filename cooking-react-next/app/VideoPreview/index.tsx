"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import { Stack, Button, Box } from '@mui/material';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

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
            <Box display={'flex'} justifyContent={'center'} width={'100%'}>
                <button
                    className='btn btn-outline'
                    color="primary"
                    onClick={() => { props.setIsVideoPlaying(true) }}
                    style={{ marginRight: 2 }}
                >
                    Video Play
                </button>
                <button
                    className='btn btn-outline'
                    color="primary"
                    onClick={() => { props.setIsVideoPlaying(false) }}
                    style={{ marginRight: 2 }}
                >
                    Video Pause
                </button>
            </Box>
            
            {/* <div style={{ height: '40vh', overflowY: 'scroll' }}>
                {transriptSentenceList.map((item: TransriptSentenceItemProps) => {
                    return (
                        <div key={item.sentenceIndex}>
                            {`${item.sentenceIndex}: ${Number(item.startTime) / 1000}-${Number(item.endTime) / 1000}: ${item.text}`}
                        </div>
                    );
                })}
            </div> */}
        </Stack>
    );
}