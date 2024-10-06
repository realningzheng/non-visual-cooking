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

20  : System evaluates reality image
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

import OpenAI from 'openai';
import axios from "axios";
import credential from '../../secret.json';

const apiKey = credential.OPENAI_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });

// define states and transitions
type StateMachineTranslator = {
	[key: number]: string;
};
export const stateTranslator: StateMachineTranslator = {
	0: "Comparing video-reality alignment",
	1: "Agent: Explain the current state*",
	2: "Agent: Explain the current step/action",
	3: "Agent: Respond with how to fix",
	4: "Agent: Freeform response",
	5: "Handling user disagreements",
	6: "Agent: Replay the relevant parts from videos"
}
export const eventTranslator: StateMachineTranslator = {
	0: "User asks about how to do a step",
	1: "User asks about the current state (not used)",
	2: "User asks how to fix something",
	3: "User disagrees",
	4: "User agrees/satisfies",
	5: "User asks for a repeat",
	6: "User asks for replaying relevant parts from the video",
	7: "User asks for other types of questions",
	8: "User asks confirmation-type questions",
	9: "User asks others",
	10: "System automatically detects misalignment",
	11: "System automatically detects a new action/step",
	12: "System automatically detects missing previous steps",
	13: "Problem solved",
	14: "Problem unsolved",
	20: "System automatically evaluates reality"
}

// Define state machine logic
type StateMachine = {
	[key: number]: {
		[key: number]: number;
	};
};


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
		4: 0,  // Agree/Satisfy
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

// State functions
const comparingVideoRealityAlignment = () => {
	// Function for state 0
};

const explainCurrentState = () => {
	// Function for state 1
};

const explainCurrentStepAction = () => {
	// Function for state 2
};

const respondWithHowToFix = () => {
	// Function for state 3
};

const freeformResponse = () => {
	// Function for state 4
};

const handlingUserDisagreements = () => {
	// Function for state 5
};

const replayRelevantPartsFromVideos = () => {
	// Function for state 6
};

export const stateFunctions: { [key: number]: () => void } = {
	0: comparingVideoRealityAlignment,
	1: explainCurrentState,
	2: explainCurrentStepAction,
	3: respondWithHowToFix,
	4: freeformResponse,
	5: handlingUserDisagreements,
	6: replayRelevantPartsFromVideos,
};

// Next event chooser
export const nextEventChooser = async (
	voiceInput: string,
	videoKnowledgeInput: string,
	currentState: number
): Promise<number> => {
	// 1. Get all possible next events based on currentState and state machine
	const possibleNextEventsObj = stateMachine[currentState];

	const possibleNextEvents: string[] = Object.keys(possibleNextEventsObj).map(event => {
		const eventNumber = Number(event); // Convert event key to number
		const eventExplanation = eventTranslator[eventNumber]; // Get explanation from eventTranslator
		return `${eventNumber}: ${eventExplanation}`;
	});
	// 2. (openai_api) Select the category of the next event based on user inputs (stream and voice)
	const prompt = `Here is the information from the video in the format of json:
					${videoKnowledgeInput}\n
					User request is: "${voiceInput}", 
					which of the following categories is most appropriate:\n 
					${possibleNextEvents.join("\n")}\n
					-1: Not related to cooking task at all\n
					Please reply ONLY the index of the most appropriate category`;
	const response = await callGpt4V(prompt);
	// @TODO: should either use functionCall or whatever to make sure the response is returned from a list of indices
	if (response) {
		console.log(response);
		return Number(response.gptResponse);
	}
	return -1;
}

async function callGpt4V(prompt: string): Promise<{ "gptResponse": string }> {
	let gptResponse = "";
	try {
		console.log(prompt);
		const response = await openai.chat.completions.create({
			model: "gpt-4-turbo",
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: `${prompt}` },
					],
				},
			],
			max_tokens: 1500,
		});
		if (response.choices[0]['message']['content']) {
			gptResponse = response.choices[0]['message']['content'];
		}
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Error calling GPT-4 API:", error.response?.data);
		} else {
			console.error("Unknown error:", error);
		}
	}
	return { "gptResponse": gptResponse };
}