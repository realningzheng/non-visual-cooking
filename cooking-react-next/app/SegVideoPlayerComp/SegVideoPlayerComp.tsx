import { Box } from '@mui/material';
import VideoSegmentPlayer from './VideoSegmentPlayer';
import VideoSegmentList from './VideoSegmentList';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

interface SegmentedVideoPlayerAndListDisplayerProps {
    sourceUrl: string;
    videoSegments: TransriptSentenceItemProps[];
    currentSentenceIndex: number;
    verticalCaptions: boolean;
    currentState: number;
    segmentedVideoPlaying: boolean;
    replaySignal: boolean;
    setPlaySeconds: (seconds: number) => void;
}

export default function SegVideoPlayerComp(props: SegmentedVideoPlayerAndListDisplayerProps) {

    return (
        <div className={`${props.verticalCaptions ? 'h-[50vh] flex flex-col gap-2' : 'h-[20vh] flex flex-row gap-2'}`}>
            <div className={props.verticalCaptions ? 'w-[60%] mx-auto' : 'h-full w-[58%] mx-auto'}>
                {props.videoSegments.length > 0 ?
                    <VideoSegmentPlayer
                        sourceUrl={props.sourceUrl}
                        segments={props.videoSegments.map(
                            segment => [
                                Number(segment.startTime) / 1000,
                                Number(segment.endTime) / 1000
                            ]
                        )}                        
                        segmentedVideoPlaying={props.segmentedVideoPlaying}
                        replaySignal={props.replaySignal}
                        setPlaySeconds={props.setPlaySeconds}
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
            </div>
            <div className={props.verticalCaptions ? 'w-full' : 'h-full w-[42%]'}>
                {props.videoSegments.length > 0 ?
                    <VideoSegmentList
                        videoSegments={props.videoSegments}
                        currentSentenceIndex={props.currentSentenceIndex}
                    />
                    :
                    <div
                        id='segmented-video-caption-list'
                        style={{ width: '100%', height: '20vh', border: '2px dashed #ccc', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' }}
                    >
                        <span style={{ color: '#666', fontSize: '1.1rem' }}>
                            Caption unavailable
                        </span>
                    </div>
                }
            </div>
        </div>
    );
} 