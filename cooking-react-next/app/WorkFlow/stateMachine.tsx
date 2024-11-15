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
0   : User asks about step related questions
1   : User asks about the current state (not used)
2   : User asks how to fix something
3   : User disagrees
4   : User agrees/satisfies 
5   : User asks for a repeat
6   : User asks for replay
7   : User asks for other types of questions
8   : User asks evaluation type of question or questions regarding the current visual scene
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
import {
	comparingVideoRealityAlignment,
	explainCurrentState,
	explainCurrentStep,
	respondWithHowToFix,
	freeformResponse,
	handlingUserDisagreements,
	replayRelevantPartsFromVideos,
	callChatGPT
} from './stateFunctions';

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
	0: "User asks about step related questions",
	2: "User asks how to fix something",
	3: "User disagrees",
	4: "User agrees/satisfies",
	5: "User asks for a repeat",
	6: "User asks for replaying relevant parts from the video",
	7: "User asks for other types of questions",
	8: "User asks evaluation type of question or questions regarding the current visual scene",
	10: "System automatically detects misalignment",
	11: "System automatically detects a new action/step",
	12: "System automatically detects missing previous steps",
	20: "System automatically evaluates reality"
}


export const eventDetailedExplanation: StateMachineTranslator = {
	0: `User asks about step related questions
       - Questions about current, previous, or future steps in the cooking process
       - Examples:
         * "What's the next step I should do?"
         * "How many steps are still left?"
         * "What did I do just now?"
         * "What steps did I miss?"
         * "What step am I on right now?"
         * "How many steps are left?"
         * "What should I do next?"
         * "Can you explain this step again?"
         * "Was I supposed to preheat the oven?"`,

	2: `User asks how to fix something
       - Requests for correction or problem-solving
       - Examples:
         * "The sauce is too thick, how do I fix it?"
         * "I added too much salt, what should I do?"
         * "The dough isn't rising, how can I fix this?"
         * "I burned the bottom, can this be saved?"`,

	3: `User disagrees
       - Expressions of disagreement with instructions or feedback
       - Examples:
         * "That's not right, the recipe said medium heat"
         * "No, I already added the eggs"
         * "I don't think that's correct"`,

	4: `User agrees/satisfies
       - Confirmations and positive acknowledgments
       - Examples:
         * "Ok, got it"
         * "Yes, that looks right"
         * "I understand now"
         * "That worked, thank you"`,

	5: `User asks for a repeat
       - Requests for information to be repeated
       - Examples:
         * "Can you say that again?"
         * "I didn't catch that"
         * "Please repeat the last instruction"
         * "What was that last part?"`,

	6: `User asks for replaying relevant parts from the video
       - Request for replaying only a specific part from the video
       - Examples:
         * "Can you show me how they did xxxxxx?"
         * "I need to see the kneading part again"
		 * "I need to hear xxxxx again"
         * "Show me the video for this step"
         * "What does it look like in the video?"
         * "Show me the part from the video that mentions xxxx"`,

	7: `User asks for other types of questions
       - General cooking queries based on the video knowledge
       - Examples:
         * "What other ingredients do we need?"`,

	8: `User asks evaluation type of question or questions regarding the current visual scene
       - Seeking verification or validation
       - Examples:
         * "Can you explain the current scene for me?"
         * "What are things around me now?"
         * "Where is the pan?"
         * "How does my steak look like now?"
         * "Should it be this color?"
         * "Am I stirring fast enough?"
         * "Is this what it's supposed to look like?"
         * "Does this look done?"`,

	10: `System automatically detects misalignment
        - AI detects discrepancy between video and user's actions
        - Examples:
          * Detecting wrong ingredient usage
          * Noticing incorrect cooking temperature
          * Identifying wrong sequence of steps
          * Spotting incorrect technique`,

	11: `System automatically detects a new action/step
        - AI recognizes transition to new cooking phase
        - Examples:
          * Detecting user has started mixing ingredients
          * Noticing transition to cooking phase
          * Identifying completion of preparation
          * Recognizing start of new recipe section`,

	12: `System automatically detects missing previous steps
        - AI identifies skipped or incomplete steps
        - Examples:
          * Noticing missing ingredient preparation
          * Detecting skipped preheating step
          * Identifying missing mixing step
          * Recognizing incomplete preparation`,

	20: `System automatically evaluates reality
        - AI performs regular assessment of cooking progress
        - Examples:
          * Checking food doneness
          * Evaluating consistency
          * Assessing temperature
          * Monitoring cooking time`
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
		7: 4,  // Other questions
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
		4: 0, // Problem solved
		3: 5, // Problem unsolved, stay in disagreement
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
	- Video knowledge is provided in JSON format, after the tag <VIDEO KNOWLEDGE>.
	- User's request is provided after the tag <USER REQUEST>.
	- Please make sure to respond with a helpful voice via audio
	- Be kind, helpful, and courteous
	- It is okay to ask the user questions
	- Use tools and functions you have available liberally, it is part of the training apparatus
	- Be open to exploration and conversation

	Personality:
	- Be upbeat and genuine
	- Try speaking quickly as if excited
`


export const stateFunctions: {
	[key: number]: (
		videoKnowledgeInput: string,
		realityImageBase64: string,
		voiceInputTranscript: string,
		memoryKv: { [key: string]: any }
	) => Promise<any>
} = {
	0: comparingVideoRealityAlignment,
	1: explainCurrentState,
	2: explainCurrentStep,
	3: respondWithHowToFix,
	4: freeformResponse,
	5: handlingUserDisagreements,
	6: replayRelevantPartsFromVideos,
};


// Add this new function after the stateFunctions object
export const executeStateFunction = async (
	stateNumber: number,
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	memoryKv: { [key: string]: any }
) => {
	const stateFunction = stateFunctions[stateNumber];
	if (stateFunction) {
		console.log(`Executing function for state ${stateNumber}: ${stateTranslator[stateNumber]}`);
		return await stateFunction(videoKnowledgeInput, realityImageBase64, voiceInputTranscript, memoryKv);
	} else {
		console.error(`No function found for event ${stateNumber}`);
		return `No function found for event ${stateNumber}`;
	}
};


// This function is used by possible next event bottons
export const asyncNextEventChooser = async (
	voiceInput: string,
	videoKnowledgeInput: string,
	currentState: number
): Promise<number> => {
	// 1. Get all possible next events based on currentState and state machine
	const possibleNextEventsObj = stateMachine[currentState];

	const possibleNextEvents: string[] = Object.keys(possibleNextEventsObj).map(event => {
		const eventNumber = Number(event); // Convert event key to number
		const eventExplanation = eventDetailedExplanation[eventNumber]; // Get explanation from eventTranslator
		return `${eventNumber}: ${eventExplanation}`;
	});
	// 2. (openai_api) Select the category of the next event based on user inputs (stream and voice)
	const prompt = `Here is the information from the video in the format of json:
					${videoKnowledgeInput}\n
					User request is: "${voiceInput}", 
					which of the following categories is most appropriate:\n 
					${possibleNextEvents.join("\n")}\n
					Please reply ONLY the index of the most appropriate category`;
	const response = await callChatGPT(prompt);
	// @TODO: should either use functionCall or whatever to make sure the response is returned from a list of indices
	if (response) {
		const nextState = Number(response.gptResponse);
		return nextState;
	}
	return -1;
}