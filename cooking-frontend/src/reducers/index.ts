import { combineReducers } from 'redux';
import videoControlReducer from './VideoControlReducer';
import userBehaviorReducer from './UserBehaviorReducer';

const rootReducer = combineReducers({
  videoControlReducer, 
  userBehaviorReducer,
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
