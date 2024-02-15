import { UserClickEvaluateActionTypes } from './types';
import { USER_CLICK_EVALUATE } from './types';
import { callGpt4 } from '../utils';

interface UserClickEvaluateStates {
    gptCalling: boolean;
    gptResponse: string;
}

export const initialState: UserClickEvaluateStates = {
    gptCalling: false,
    gptResponse: "",
};

export default async function userBehaviorReducer(
    state = initialState,
    action: UserClickEvaluateActionTypes
): Promise<UserClickEvaluateStates> {
    switch (action.type) {
        case USER_CLICK_EVALUATE:
            console.log(action)
            let response = await callGpt4(action.prompt, action.imageURLList);
            return {
                ...state,
                gptResponse: response
            };
        default:
            return state;
    }
}