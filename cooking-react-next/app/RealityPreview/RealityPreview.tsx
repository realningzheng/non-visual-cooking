import { Stack, Box } from "@mui/material";
import { RefObject } from "react";

interface RealityPreviewProps {
    isClient: boolean;
    videoRef: RefObject<HTMLVideoElement>;
}

export default function RealityPreview(props: RealityPreviewProps) {
    return (
        <>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '20px', alignItems: 'flex-start' }}>
                <Stack spacing={0} justifyContent={'center'} sx={{ flex: 1 }}>
                    {props.isClient &&
                        <div style={{
                            width: '75%',
                            height: '20vh',
                            position: 'relative',
                            backgroundColor: '#000000',
                            borderRadius: '5px',
                            overflow: 'hidden',
                            margin: 'auto'
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
                </Stack>
            </div>
            {/* <Box
                display={'flex'}
                justifyContent={'center'}
                width={'100%'}
                marginTop={'10px'}
            >
                <button
                    className='btn btn-outline btn-sm'
                    color="primary"
                    onClick={() => { props.videoRef.current?.play() }}
                    style={{ marginRight: 1 }}
                >
                    Reality Play
                </button>
                <button
                    className='btn btn-outline btn-sm'
                    color="primary"
                    onClick={() => { props.videoRef.current?.pause() }}
                    style={{ marginRight: 1, marginLeft: 1 }}
                >
                    Reality Pause
                </button>
            </Box> */}
        </>
    );
} 