/* --------------------------------------------------------------
States:
0   : Comparing video-reality alignment
1   : Agent: Explain the current state*
2   : Agent: Explain the current step/action
3   : Agent: Respond with how to fix
4   : Agent: Freeform response
5   : Handling user disagreements
6   : Agent: Replay the relevant parts from videos
-----------------------------------------------------------------
UserInput Categories:
0   : User asks about how to do a step
1   : User asks about the current state (not used)
2   : User asks how to fix something
3   : User disagrees
4   : User agrees/satisfies 
5   : User asks for a repeat
6   : User asks for replay
7   : User asks for other types of questions
8   : User asks confirmation-type questions
9   : User asks others

10  : System automatically detects misalignment
11  : System automatically detects a new action/step
12  : System automatically detects missing previous steps
13  : Problem solved
14  : Problem unsolved

20  : timeout
-----------------------------------------------------------------
State Transitions:
| state | category | next state |
|-------|----------|------------|
| 0     | 0        | 2          |
| 0     | 11       | 2          |
| 0     | 8        | 1          |
| 0     | 10       | 1          |
| 0     | 12       | 4          |
| 0     | 7        | 4          |
| 0     | 6        | 6          |
| 0     | 20       | 0          |
| 1     | 3        | 5          |
| 1     | 5        | 1          |
| 1     | 2        | 3          |
| 1     | 6        | 6          |
| 1     | 9        | 4          |
| 1     | 4        | 0          |
| 2     | 3        | 5          |
| 2     | 2        | 3          |
| 2     | 5        | 2          |
| 3     | 4        | 0          |
| 3     | 5        | 3          |
| 3     | 3        | 5          |
| 3     | 6        | 6          |
| 4     | 5        | 4          |
| 4     | 3        | 5          |
| 4     | 6        | 6          |
| 4     | 4        | 0          |
| 5     | 13       | 0          |
| 5     | 14       | 5          |
| 6     | 3        | 5          |
| 6     | 5        | 6          |
| 6     | 4        | 0          |
-----------------------------------------------------------------*/


// Define the state transitions using a dictionary
type StateMachine = {
    [key: number]: {
      [key: number]: number;
    };
  };
type StateMachineTranslator = {
    [key: number]: string;
  };
export const stateTranslator: StateMachineTranslator = {
    0   : "Comparing video-reality alignment",
    1   : "Agent: Explain the current state*",
    2   : "Agent: Explain the current step/action",
    3   : "Agent: Respond with how to fix",
    4   : "Agent: Freeform response",
    5   : "Handling user disagreements",
    6   : "Agent: Replay the relevant parts from videos"
}
export const eventTranslator: StateMachineTranslator = {
    0   : "User asks about how to do a step",
    1   : "User asks about the current state (not used)",
    2   : "User asks how to fix something",
    3   : "User disagrees",
    4   : "User agrees/satisfies",
    5   : "User asks for a repeat",
    6   : "User asks for replay",
    7   : "User asks for other types of questions",
    8   : "User asks confirmation-type questions",
    9   : "User asks others",
    10  : "System automatically detects misalignment",
    11  : "System automatically detects a new action/step",
    12  : "System automatically detects missing previous steps",
    13  : "Problem solved",
    14  : "Problem unsolved",
    20  : "timeout"
}
export const stateMachine: StateMachine = {
    0: {
      0: 2,  // Ask how to do a step
      11: 2, // New action detected
      8: 1,  // Confirmation-type questions
      10: 1, // Misalignment detected
      12: 4, // Missing previous steps
      7: 4,  // Ask other types of questions
      6: 6,  // Replay requested
      20: 0, // Timeout, stay in current state
    },
    1: {
      3: 5,  // Disagreement
      5: 1,  // Repeat
      2: 3,  // How to fix
      6: 6,  // Replay requested
      9: 4,  // Other questions
      4: 0,  // Agree/Satisfy
    },
    2: {
      3: 5,  // Disagreement
      2: 3,  // How to fix
      5: 2,  // Repeat
    },
    3: {
      4: 0,  // Agree/Satisfy
      5: 3,  // Repeat
      3: 5,  // Disagreement
      6: 6,  // Replay requested
    },
    4: {
      5: 4,  // Repeat
      3: 5,  // Disagreement
      6: 6,  // Replay requested
      4: 0,  // Agree/Satisfy
    },
    5: {
      13: 0, // Problem solved
      14: 5, // Problem unsolved, stay in disagreement
    },
    6: {
      3: 5,  // Disagreement
      5: 6,  // Repeat
      4: 0,  // Agree/Satisfy
    },
};