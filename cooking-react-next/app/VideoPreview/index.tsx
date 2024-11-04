"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import { Stack, Box } from '@mui/material';
import transriptSentenceList from '../data/rwYaDqXFH88_sentence.json';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

interface VideoPreviewProps {
    vurl: string;
    isVideoPlaying: boolean;
    currentState: number;
    stateFunctionExeRes: string;
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
            <div className='divider'></div>
            <div
                id='segmented-video-preview'
                style={{
                    width: '100%',
                    height: '20vh',
                    border: '2px dashed #ccc',
                    borderRadius: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                }}
            >
                <span style={{ color: '#666', fontSize: '1.1rem' }}>
                    Segmented video unavailable
                </span>
            </div>
            {props.currentState === 6 && props.stateFunctionExeRes && (
                <div style={{ height: '40vh', overflowY: 'scroll' }}>
                    {JSON.parse(props.stateFunctionExeRes).sentence_IDs.map((item: number) => {
                        const sentence = transriptSentenceList.find(
                            (s) => s.sentenceIndex === item
                        );
                        return sentence ? (
                            <div key={`retrieved-sentence-id-${item}`}>
                                {`${sentence.sentenceIndex}: ${Number(sentence.startTime) / 1000}-${Number(sentence.endTime) / 1000}: ${sentence.text}`}
                            </div>
                        ) : null;
                    })}
                </div>
            )}
        </Stack >
    );
}