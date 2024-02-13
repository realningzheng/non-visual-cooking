import { START_VIDEO_PLAY } from './types';

// Actions
export const userStartVideoPlay = (isPlaying: boolean) => ({
    type: START_VIDEO_PLAY,
    payload: isPlaying
});

