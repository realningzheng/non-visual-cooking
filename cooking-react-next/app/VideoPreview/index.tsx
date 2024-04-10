"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import transriptSentenceList from '../data/cooking_steak_sentence.json';
import { Stack, Button, Box } from '@mui/material';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

interface VideoPreviewProps {
    vurl: string;
    isPlaying: boolean;
    setIsPlaying: (isPlaying: boolean) => void;
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
                        playing={props.isPlaying}
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
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => { props.setIsPlaying(true) }}
                    sx={{ marginRight: 2 }}
                >
                    Video Play
                </Button>
                <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => { props.setIsPlaying(false) }}
                    sx={{ marginRight: 2 }}
                >
                    Video Pause
                </Button>
            </Box>
            <div style={{ height: '40vh', overflowY: 'scroll' }}>
                {transriptSentenceList.map((item: TransriptSentenceItemProps) => {
                    return (
                        <div key={item.sentenceIndex}>
                            {`${item.sentenceIndex}: ${Number(item.startTime) / 1000}-${Number(item.endTime) / 1000}: ${item.text}`}
                        </div>
                    );
                })}
            </div>
        </Stack>
    );
}