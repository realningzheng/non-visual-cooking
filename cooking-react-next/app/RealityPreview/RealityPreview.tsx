import { Stack, Box } from "@mui/material";
import { RealityPreviewProps } from "../types/common";

/**
 * RealityPreview component displays the video feed and captured image
 */
export default function RealityPreview(props: RealityPreviewProps) {
    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
                {/* Video feed display */}
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
                                autoPlay
                                playsInline
                            />
                        </div>
                    }
                    {/* Hidden canvas for image capture */}
                    <canvas
                        ref={props.canvasRef}
                        style={{ display: 'none' }}
                    />
                </Stack>
                
                {/* Captured image display */}
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
            
            {/* Control buttons - currently commented out */}
            <Box
                display={'flex'}
                justifyContent={'center'}
                width={'100%'}
                marginTop={'10px'}
            >
            </Box>
        </>
    );
} 