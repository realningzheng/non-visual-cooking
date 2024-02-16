// TypeScript Types for Actions
export type VideoControlActionTypes = {
    type: string;
    payload: boolean;
}

export type UserClickEvaluateActionTypes = {
    type: string;
    prompt: string;
    imageURLList: string[];
}

// State types
export const START_VIDEO_PLAY = 'START_VIDEO_PLAY';
export const STOP_VIDEO_PLAY = 'STOP_VIDEO_PLAY';
export const USER_CLICK_EVALUATE = 'USER_CLICK_EVALUATE';
export const USER_CLICK_REASONING = 'USER_CLICK_REASONING';