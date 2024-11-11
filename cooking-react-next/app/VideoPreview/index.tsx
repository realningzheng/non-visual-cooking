"use client";

import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import { Stack, Box, Typography } from '@mui/material';
import transriptSentenceList from '../data/rwYaDqXFH88_sentence.json';
import VideoSegmentPlayer from '../components/VideoSegmentPlayer';

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
    const [videoSegments, setVideoSegments] = useState<TransriptSentenceItemProps[]>([]);
    const [playSeconds, setPlaySeconds] = useState<number>(0);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number | null>(null);

    // set up client state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);


    // check if the response can be parsed as json
    useEffect(() => {
        if (props.currentState === 6) {
            try {
                let parsedRes = JSON.parse(props.stateFunctionExeRes);
                setVideoSegments(parsedRes.map((item: number) => {
                    let sentence = transriptSentenceList.find(s => s.sentenceIndex === item);
                    return sentence;
                }));
                setPlaySeconds(0);
            } catch (error) {
                setVideoSegments([]);
                setPlaySeconds(0);
            }
        }
    }, [props.stateFunctionExeRes, props.currentState]);

    
    // scroll to the current sentence
    useEffect(() => {
        if (props.currentState === 6 && videoSegments.length > 0) {
            const currentSentence = videoSegments.find((item: TransriptSentenceItemProps) => {
                return item &&
                    playSeconds >= Number(item.startTime) / 1000 &&
                    playSeconds <= Number(item.endTime) / 1000;
            });
            setCurrentSentenceIndex(currentSentence ? currentSentence.sentenceIndex : null);

            // Scroll to the current sentence
            if (currentSentence) {
                const element = document.getElementById(`sentence-${currentSentence.sentenceIndex}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [playSeconds]);


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
            <div className='text-2xl font-bold'>Segmented video preview</div>
            {props.currentState === 6 && videoSegments.length > 0 ?
                <VideoSegmentPlayer
                    sourceUrl={props.vurl}
                    segments={videoSegments.map(
                        segment =>
                            [Number(segment.startTime) / 1000,
                            Number(segment.endTime) / 1000]
                    )}
                    setPlaySeconds={setPlaySeconds}
                />
                :
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
            }
            {props.currentState === 6 && videoSegments.length > 0 && (
                <Box
                    sx={{
                        height: '20vh',
                        overflowY: 'scroll',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        padding: 2,
                        backgroundColor: '#fafafa',
                    }}
                >
                    {videoSegments.map((sentence: TransriptSentenceItemProps) => (
                        <Box
                            id={`sentence-${sentence.sentenceIndex}`}
                            key={`retrieved-sentence-id-${sentence.sentenceIndex}`}
                            sx={{
                                padding: 1.5,
                                marginBottom: 1,
                                borderLeft: '4px solid #2196f3',
                                backgroundColor: currentSentenceIndex === sentence.sentenceIndex ? '#e3f2fd' : 'white',
                                borderRadius: '4px',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    backgroundColor: '#f5f5f5',
                                }
                            }}
                        >
                            <Typography variant="body2" color="text.secondary" sx={{ marginBottom: 0.5 }}>
                                {`${sentence.sentenceIndex} • ${Number(sentence.startTime) / 1000}s - ${Number(sentence.endTime) / 1000}s`}
                            </Typography>
                            <Typography variant="body1">
                                {sentence.text}
                            </Typography>
                        </Box>
                    ))}
                </Box>
            )}
        </Stack >
    );
}