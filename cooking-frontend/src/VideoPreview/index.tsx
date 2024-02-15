import React, { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player'
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../reducers';
import transriptSentenceList from '../data/cooking_steak_sentence.json';
import { Stack } from '@mui/material';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

interface VideoPreviewProps {
    vurl: string;
}

export default function VideoPreview(props: VideoPreviewProps) {
    const videoPlayerRef = useRef<ReactPlayer>(null);
    const isPlaying = useSelector((state: RootState) => state.videoControlReducer.isPlaying);

    return (
        <Stack spacing={2} justifyContent={'center'}>
            <div
                style={{
                    position: "relative",
                    width: "100%",
                    height: 0,
                    paddingTop: '56.25%'
                }}
            >
                <ReactPlayer
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
            <div style={{ height: '40vh', overflowY: 'scroll' }}>
                {transriptSentenceList.map((item: TransriptSentenceItemProps) => {
                    return (
                        <div key={item.sentenceIndex}>
                            {`${item.sentenceIndex}: ${Number(item.startTime)/1000}-${Number(item.endTime)/1000}: ${item.text}`}
                        </div>
                    );
                })}
            </div>
        </Stack>
    );
}