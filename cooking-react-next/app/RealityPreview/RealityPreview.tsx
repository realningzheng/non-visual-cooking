import { Stack, Box } from "@mui/material";
import { RefObject } from "react";

interface RealityPreviewProps {
    isClient: boolean;
    videoRef: RefObject<HTMLVideoElement>;
    canvasRef: RefObject<HTMLCanvasElement>;
    realityImageBase64: string;
}

export default function RealityPreview(props: RealityPreviewProps) {
    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
                <Stack spacing={0} justifyContent={'center'} sx={{ flex: 1 }}>
                    {props.isClient &&
                        <div style={{
                            width: '100%',
                            height: '15vh',
                            position: 'relative',
                            backgroundColor: '#000000',
                            borderRadius: '5px'
                        }}>
                            <video
                                ref={props.videoRef}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    position: 'absolute',
                                    zIndex: 1,
                                    objectFit: 'contain',
                                    margin: 'auto'
                                }}
                            />
                        </div>
                    }
                    <canvas
                        ref={props.canvasRef}
                        style={{ display: 'none' }}
                    />
                </Stack>
                <div style={{ flex: 1 }}>
                    {props.realityImageBase64 ? (
                        <img
                            src={props.realityImageBase64}
                            alt="Reality Capture"
                            style={{
                                width: '100%',
                                height: '15vh',
                                objectFit: 'contain',
                            }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '100%',
                                height: '15vh',
                                border: '2px dashed #ccc',
                                borderRadius: '5px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: '#f5f5f5',
                            }}
                        >
                            <span style={{ color: '#666', fontSize: '1.1rem' }}>
                                No image captured yet
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <Box
                display={'flex'}
                justifyContent={'center'}
                width={'100%'}
                marginTop={'10px'}
            >
                <button
                    className='btn btn-outline'
                    color="primary"
                    onClick={() => { props.videoRef.current?.play() }}
                    style={{ marginRight: 1 }}
                >
                    Reality Play
                </button>
                <button
                    className='btn btn-outline'
                    color="primary"
                    onClick={() => { props.videoRef.current?.pause() }}
                    style={{ marginRight: 1, marginLeft: 1 }}
                >
                    Reality Pause
                </button>
            </Box>
        </>
    );
} 