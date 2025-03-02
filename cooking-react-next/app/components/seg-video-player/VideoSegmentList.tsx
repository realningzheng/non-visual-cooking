import { Box, Typography } from '@mui/material';

interface TransriptSentenceItemProps {
    sentenceIndex: number;
    text: string;
    startTime: string;
    endTime: string;
}

interface VideoSegmentListProps {
    videoSegments: TransriptSentenceItemProps[];
    currentSentenceIndex: number;
}

export default function VideoSegmentList({ videoSegments, currentSentenceIndex }: VideoSegmentListProps) {
    return (
        <Box
            sx={{
                height: '100%',
                overflowY: 'auto',
                // border: '1px solid #e0e0e0',
                // borderRadius: '8px',
                // padding: 1,
                // backgroundColor: '#fafafa',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {videoSegments.map((sentence: TransriptSentenceItemProps) => (
                <Box
                    id={`sentence-${sentence.sentenceIndex}`}
                    key={`retrieved-sentence-id-${sentence.sentenceIndex}`}
                    sx={{
                        padding: 1,
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
    );
} 