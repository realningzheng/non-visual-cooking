import {
    START_VIDEO_PLAY,
    USER_CLICK_EVALUATE,
    USER_CLICK_REASONING
} from './types';
import { UserClickEvaluateActionTypes } from './types';

// Actions
export const userStartVideoPlay = (isPlaying: boolean) => ({
    type: START_VIDEO_PLAY,
    payload: isPlaying
});

export const userClickEvaluate = (systemPrompt:string, imageListBase64: string[]) => ({
    type: USER_CLICK_EVALUATE,
    prompt: systemPrompt,
    imageURLList: imageListBase64
});

export const userClickReasoning = (systemPrompt: string) => ({
    type: USER_CLICK_REASONING,
    prompt: systemPrompt
});