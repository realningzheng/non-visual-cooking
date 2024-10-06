"use client";

import { Button, Grid, Stack, Box, TextField } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import LinearProgress from '@mui/material/LinearProgress';
import * as utils from '../utils';


/* States:
0   : Comparing video-reality alignment
1   : Agent: Explain the current state*
2   : Agent: Explain the current step/action
3   : Agent: Respond with how to fix
4   : Agent: Freeform response
5   : Handling user disagreements
6   : Agent: Replay the relevant parts from videos
*/
/* UserInput Categories:
0   : User asks about how to do a step
1   : User asks about the current state
2   : User asks how to fix something
3   : User disagrees
4   : User agrees/satisfies
5   : User asks for a repeat
6   : System automatically detects misalignment
7   : System automatically detects a new action/step
8   : User asks for replay
9   : User asks for other types of questions

Other Categories:
10  : timeout
*/
/* State Transitions:
| state | category | next state |
|-------|----------|------------|
| 0     | 1        | 2          |
| 0     | 2        | 1          |
| 1     | 3        | 4          |

*/


export default function WorkFlow() {
    const [CurrentState, setCurrentState] = useState("");
    const [UserVoiceInput, setUserVoiceInput] = useState("");
    const [UserStreamInput, setUserStreamInput] = useState("");

    const decodeUserInput = () => {
        // TODO
        
    };

    return (
        <div>
            <h2>Work Flow</h2>
            <h3>User Voice Input</h3>
            <TextField
                id="outlined-basic"
                label="Sentence"
                variant="outlined"
                onChange={(e) => setUserVoiceInput(e.target.value)}
                style={{ width: '50%' }}
            />
            <h3>User Stream Input</h3>
            <TextField
                id="outlined-basic"
                label="Sentence"
                variant="outlined"
                onChange={(e) => setUserStreamInput(e.target.value)}
                style={{ width: '50%' }}
            />
            <h3>Send</h3>
            <Button
                variant="contained"
                color="secondary"
                onClick={() => decodeUserInput()}
                style={{ width: '30%' }}
            >
                send
            </Button>
            <p>voice category: {UserVoiceInput}</p>
            <p>stream category: {UserStreamInput}</p>
            <h3>Current State</h3>
            <p>{CurrentState}</p>
            
        </div>
    );
}