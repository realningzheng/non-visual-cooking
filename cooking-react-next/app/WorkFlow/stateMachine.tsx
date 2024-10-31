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
0   : User asks about a step
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

// Define state machine logic
type StateMachine = {
	[key: number]: {
		[key: number]: number;
	};
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
	0: "User asks about a step",
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

const basePrompt = `
	System settings:
	Tool use: enabled.

	Instructions:
	- You are an artificial intelligence agent responsible for helping low-vision users cook in the kitchen.
	- The user has provided a video knowledge in JSON format which contains multimodal information on how to correctly cook in the kitchen.
	- Please help the user by answering their questions and guiding them through the cooking process based on the video knowledge.
	- Please make sure to respond with a helpful voice via audio
	- Be kind, helpful, and courteous
	- It is okay to ask the user questions
	- Use tools and functions you have available liberally, it is part of the training apparatus
	- Be open to exploration and conversation

	Personality:
	- Be upbeat and genuine
	- Try speaking quickly as if excited

`
// State functions
const comparingVideoRealityAlignment = async (	// state 0
	videoKnowledgeInput: string,
	realityImageBase64: string
) => {
	// TODO: extract reality information from realityImageBase64
	const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		Please compare the video-reality alignment.
	`;
	const response = await callChatGPT(prompt);
	return response.gptResponse;
};

const explainCurrentState = async (				// state 1
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	// TODO: extract current state
	const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		Please explain the current state.
	`;
	const response = await callChatGPT(prompt, [realityImageBase64]);
	return response.gptResponse;
};

const explainCurrentStepAction = async (		// state 2
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	const prompt = `\nPlease focus on the current action of the user, what is the user doing? what step the user is at given the video knowledge? How do to it right?`
	const fullPrompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		${prompt}
	`;
	console.log(`[state specific prompt]: ${prompt}`);
	const response = await callChatGPT(fullPrompt, [realityImageBase64]);
	return response.gptResponse;
};

const respondWithHowToFix = async (				// state 3
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	// TODO: extract reality information from realityImageBase64
	const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		Please explain how to fix the issue presented by the user: "${voiceInputTranscript}".
	`;
	const response = await callChatGPT(prompt);
	return response.gptResponse;
};

const freeformResponse = async (				// state 4
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	// TODO: extract reality information from realityImageBase64
	const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		Please answer the user's question: "${voiceInputTranscript}".
	`;
	const response = await callChatGPT(prompt);
	return response.gptResponse;
};

const handlingUserDisagreements = async (		// state 5
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		Please respond to the user's disagreement: "${voiceInputTranscript}".
	`;
	const response = await callChatGPT(prompt);
	return response.gptResponse;
};

const replayRelevantPartsFromVideos = async (	// state 6
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		Please present the timestamp of video knowledge related to "${voiceInputTranscript}".
	`;
	const response = await callChatGPT(prompt);
	return response.gptResponse;
};

export const stateFunctions: {
	[key: number]: (
		videoKnowledgeInput: string,
		realityImageBase64: string,
		voiceInputTranscript: string
	) => void
} = {
	0: comparingVideoRealityAlignment,
	1: explainCurrentState,
	2: explainCurrentStepAction,
	3: respondWithHowToFix,
	4: freeformResponse,
	5: handlingUserDisagreements,
	6: replayRelevantPartsFromVideos,
};


// Add this new function after the stateFunctions object
export const executeStateFunction = (
	stateNumber: number,
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string
) => {
	const stateFunction = stateFunctions[stateNumber];
	if (stateFunction) {
		console.log(`Executing function for state ${stateNumber}: ${stateTranslator[stateNumber]}`);
		return stateFunction(videoKnowledgeInput, realityImageBase64, voiceInputTranscript);
	} else {
		console.error(`No function found for event ${stateNumber}`);
		return "<VOID>";
	}
};


// Modify the nextEventChooser function to call executeStateFunction
export const asyncNextEventChooser = async (
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
	const response = await callChatGPT(prompt);
	// @TODO: should either use functionCall or whatever to make sure the response is returned from a list of indices
	if (response) {
		// console.log(response);
		const nextState = Number(response.gptResponse);
		return nextState;
	}
	return -1;
}

async function callChatGPT(prompt: string, imageUrls: string[] = []): Promise<{ "gptResponse": string }> {
	let gptResponse = "";
	try {
		// Construct content array with text prompt and any provided images
		const content: Array<{ type: string } & Record<string, any>> = [
			{ type: "text", text: prompt }
		];

		// Add any image URLs to the content array
		imageUrls.forEach(url => {
			content.push({
				type: "image_url",
				image_url: {
					url: url
				}
			});
		});

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "user",
					content: content as any[]
				}
			],
			max_tokens: 1500,
		});

		if (response.choices[0]?.message?.content) {
			gptResponse = response.choices[0].message.content;
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