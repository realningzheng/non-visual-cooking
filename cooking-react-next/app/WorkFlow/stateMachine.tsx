/* --------------------------------------------------------------
States:
0   : Comparing video-reality alignment
1   : Agent: Explain the current state*
2   : Agent: Explain the current step/action
3   : Agent: Respond with how to fix
4   : Agent: Freeform response
5   : Handling user disagreements
6   : Agent: Replay the relevant parts from videos
7   : Agent: Answer user step related questions
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
9   : User asks about previous user steps

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
	explainCurrentFoodState,
	respondWithStepRelatedQuestions,
	respondWithHowToFix,
	freeformResponse,
	handlingUserDisagreements,
	replayRelevantPartsFromVideos,
	retrievePreviousStepsOrInteractions,
} from './stateFunctions';
import { callChatGPT } from './utils';
import {
	systemPromptEventDetection,
	systemPromptStateFunctions
} from '../prompt';

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
	1: "Agent: Explain the current state of the food",
	2: "Agent: Respond with step related questions",
	3: "Agent: Respond with how to fix",
	4: "Agent: Freeform response",
	5: "Agent: Handling user disagreements",
	6: "Agent: Replay the relevant parts from videos",
	7: "Agent: Retrieve previous steps or interactions"
}


export const eventTranslator: StateMachineTranslator = {
	0: "User asks about step related questions",
	2: "User asks how to fix something",
	3: "User disagrees",
	4: "User agrees/satisfies",
	5: "User asks for repeating the previous instruction or agent response",
	6: "User asks for replaying relevant parts from the video",
	7: "User asks for general questions",
	8: "User asks evaluation type of question or questions regarding the current visual scene",
	9: "User seeks to retrieve previous steps or interactions",
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
         * "What steps did I miss?"
         * "What step am I on right now?"
         * "What should I do next?" 
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

	5: `User asks for repeating the previous instruction or agent response
       - Requests for information to be repeated
       - Examples:
         * "Can you say that again?"
         * "I didn't catch that"
         * "Please repeat the last instruction"
         * "What was that last part?"`,

	6: `User asks for replaying relevant parts from the video
       - Request for replaying only a specific part from the video
       - Examples:
         * "Replay xxx from the video"
         * "Can you show me how they did xxx from the video?"
         * "I need to see the kneading part again"
		 * "I need to hear xxx again"
         * "Replay the video for this step"`,

	7: `User asks for general questions
       - General cooking queries based on the video knowledge except for a specific steps or evaluation type questions
       - Examples:
         * "What other ingredients do we need?"
		 * "How many steps are still left?"`,

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

	9: `User seeks to retrieve previous steps or interactions
       - Asking for recall of previous steps or actions
       - Examples:
         * "What's my last step?"
	   	 * "What did I do before this?"
		 * "What did I add last?"
		 * "What are my last three steps?"`,

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
		9: 7,  // Ask about previous user steps
	},
	1: {
		3: 5,  // Disagreement
		5: 1,  // Repeat
		2: 3,  // How to fix
		6: 6,  // Replay requested
		7: 4,  // Other questions
		4: 0,  // Agree/Satisfy
		9: 7,  // Ask about previous user steps
	},
	2: {
		4: 0,  // Agree/Satisfy
		3: 5,  // Disagreement
		2: 3,  // How to fix
		5: 2,  // Repeat
		9: 7,  // Ask about previous user steps
	},
	3: {
		4: 0,  // Agree/Satisfy
		5: 3,  // Repeat
		3: 5,  // Disagreement
		6: 6,  // Replay requested
		9: 7,  // Ask about previous user steps
	},
	4: {
		5: 4,  // Repeat
		3: 5,  // Disagreement
		6: 6,  // Replay requested
		4: 0,  // Agree/Satisfy
		9: 7,  // Ask about previous user steps
	},
	5: {
		4: 0, // Problem solved
		3: 5, // Problem unsolved, stay in disagreement
		9: 7,  // Ask about previous user steps
	},
	6: {
		3: 5,  // Disagreement
		5: 6,  // Repeat
		4: 0,  // Agree/Satisfy
		9: 7,  // Ask about previous user steps
	},
	7: {
		3: 5,  // Disagreement
		5: 6,  // Repeat
		4: 0,  // Agree/Satisfy
		9: 7,  // Ask about previous user steps
	},
};


export const stateFunctions: {
	[key: number]: (
		videoKnowledgeInput: string,
		realityImageBase64: string,
		voiceInputTranscript: string,
		interactionMemoryKv: { [key: string]: any },
		autoAgentResponseMemoryKv: { [key: string]: any }
	) => Promise<any>
} = {
	0: comparingVideoRealityAlignment,
	1: explainCurrentFoodState,
	2: respondWithStepRelatedQuestions,
	3: respondWithHowToFix,
	4: freeformResponse,
	5: handlingUserDisagreements,
	6: replayRelevantPartsFromVideos,
	7: retrievePreviousStepsOrInteractions,
};


// Add this new function after the stateFunctions object
export const executeStateFunction = async (
	stateNumber: number,
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const stateFunction = stateFunctions[stateNumber];
	if (stateFunction) {
		console.log(`Executing function for state ${stateNumber}: ${stateTranslator[stateNumber]}`);
		return await stateFunction(videoKnowledgeInput, realityImageBase64, voiceInputTranscript, interactionMemoryKv, autoAgentResponseMemoryKv);
	} else {
		console.error(`No function found for event ${stateNumber}`);
		return `No function found for event ${stateNumber}`;
	}
};


// This function is used by possible next event bottons
export const asyncNextEventChooser = async (
	voiceInput: string,
	currentState: number
): Promise<number> => {
	// 1. Get all possible next events based on currentState and state machine
	const possibleNextEventsObj = stateMachine[currentState];

	const possibleNextEvents: string[] = Object.keys(possibleNextEventsObj).map(event => {
		const eventNumber = Number(event); // Convert event key to number
		if (eventNumber >= 10 && eventNumber <= 20) return '';
		const eventExplanation = eventDetailedExplanation[eventNumber]; // Get explanation from eventTranslator
		return `${eventNumber}: ${eventExplanation}`;
	});
	// 2. (openai_api) Select the category of the next event based on user inputs (stream and voice)
	const prompt = `<USER REQUEST>: 
					${voiceInput}
					<CATEGORY>:
					${possibleNextEvents.join("\n")}
					Please decide which category my request belongs to.
					Please reply ONLY the index of the most appropriate category
					`;
	const response = await callChatGPT(systemPromptEventDetection, prompt);
	if (response) {
		const eventNumber = Number(response.response[0]);
		return eventNumber;
	}

	return -1;
}