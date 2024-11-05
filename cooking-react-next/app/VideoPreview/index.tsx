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
    const [videoSegments, setVideoSegments] = useState<[number, number][]>([[0, 0]]);
    const [isJsonfiedExeres, setIsJsonfiedExeres] = useState<boolean>(false);
    const [playSeconds, setPlaySeconds] = useState<number>(0);
    const sentenceListRef = useRef<HTMLDivElement>(null);
    const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number | null>(null);
    
    // set up client state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsClient(true);
        }
    }, []);


    useEffect(() => {
        if (props.currentState === 6 && isJsonfiedExeres) {
            const parsedRes = JSON.parse(props.stateFunctionExeRes);
            setVideoSegments(parsedRes.sentence_IDs.map((item: number) => {
                const sentence = transriptSentenceList.find(s => s.sentenceIndex === item);
                return [Number(sentence?.startTime) / 1000, Number(sentence?.endTime) / 1000] as [number, number];
            }));
        }
    }, [isJsonfiedExeres, props.stateFunctionExeRes, props.currentState]);


    // check if the response can be parsed as json
    useEffect(() => {
        try {
            JSON.parse(props.stateFunctionExeRes);
            setIsJsonfiedExeres(true);
        } catch (error) {
            setIsJsonfiedExeres(false);
        }
    }, [props.stateFunctionExeRes]);


    useEffect(() => {
        if (props.currentState === 6 && isJsonfiedExeres) {
            const parsedRes = JSON.parse(props.stateFunctionExeRes);
            const currentSentence = parsedRes.sentence_IDs.find((item: number) => {
                const sentence = transriptSentenceList.find(s => s.sentenceIndex === item);
                return sentence && 
                    playSeconds >= Number(sentence.startTime) / 1000 && 
                    playSeconds <= Number(sentence.endTime) / 1000;
            });
            setCurrentSentenceIndex(currentSentence || null);

            // Scroll to the current sentence
            if (currentSentence) {
                const element = document.getElementById(`sentence-${currentSentence}`);
                element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [playSeconds, props.currentState, isJsonfiedExeres, props.stateFunctionExeRes]);


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
            {props.currentState === 6 && isJsonfiedExeres ?
                <VideoSegmentPlayer
                    sourceUrl={props.vurl}
                    segments={videoSegments}
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
            {props.currentState === 6 && isJsonfiedExeres && (
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
                    {JSON.parse(props.stateFunctionExeRes).sentence_IDs.map((item: number) => {
                        const sentence = transriptSentenceList.find(
                            (s) => s.sentenceIndex === item
                        );
                        return sentence ? (
                            <Box
                                id={`sentence-${item}`}
                                key={`retrieved-sentence-id-${item}`}
                                sx={{
                                    padding: 1.5,
                                    marginBottom: 1,
                                    borderLeft: '4px solid #2196f3',
                                    backgroundColor: currentSentenceIndex === item ? '#e3f2fd' : 'white',
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
                        ) : null;
                    })}
                </Box>
            )}
        </Stack >
    );
}