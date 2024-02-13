import { combineReducers } from 'redux';
import videoControlReducer from './VideoControlReducer';

const rootReducer = combineReducers({
  videoControlReducer, // Add other reducers here
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
