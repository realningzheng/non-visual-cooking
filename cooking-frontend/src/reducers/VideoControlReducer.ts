import { VideoControlActionTypes } from './types';
import {
    START_VIDEO_PLAY,
    STOP_VIDEO_PLAY
} from './types';

interface VideoControlStates {
    isPlaying: boolean;
}

export const initialState: VideoControlStates = {
    isPlaying: false,
};

export default function videoControlReducer(
    state = initialState,
    action: VideoControlActionTypes
): VideoControlStates {
    switch (action.type) {
        case START_VIDEO_PLAY:
            return {
                ...state,
                isPlaying: action.payload,
            };
        case STOP_VIDEO_PLAY:
            return {
                ...state,
                isPlaying: action.payload,
            };
        default:
            return state;
    }
}