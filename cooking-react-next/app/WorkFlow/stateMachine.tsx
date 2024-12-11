import {
	comparingVideoRealityAlignment,
	explainCurrentFoodState,
	respondWithStepRelatedQuestions,
	respondWithHowToFix,
	freeformResponse,
	handlingUserDisagreements,
	replayRelevantPartsFromVideos,
	retrievePreviousStepsOrInteractions,
	followUpWithDetails,
} from './eventStateFunctions';
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
	6: "Agent: Replay the relevant parts from videos (add-on state)",
	7: "Agent: Retrieve previous interaction results (add-on state)",
	8: "Agent: Follows up (with details) from the previous interaction",
}


export const eventTranslator: StateMachineTranslator = {
	0: "User asks about step related questions",
	1: "User asks follow-up questions",
	2: "User perceives a problem and asks how to fix something",
	3: "User disagrees",
	4: "User agrees",
	5: "User asks for repeating a previous interaction",
	6: "User asks for controlling the video playback",
	7: "User asks for general type of questions",
	8: "User asks about food state related questions",
	// 9: "User seeks to retrieve previous steps or interactions",
	10: "System detects food state misalignment",
	// 11: "System automatically detects a new action/step",
	12: "System detects dependent steps missing",
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
	
	1: `User asks follow-up questions
       - User in general agrees, or explicitly showing disagreement from the last interaction, but seeks more details
       - Examples:
         * "Tell me more about it."
         * "I mean the the actual ingredients needed."
         * "I also hear sizzling sound, is it normal?"`,
	
	2: `User perceives a problem and asks how to fix something
       - Requests for correction or problem-solving
       - Examples:
         * "The sauce is too thick, how do I fix it?"
         * "I added too much salt, what should I do?"
         * "The dough isn't rising, how can I fix this?"
         * "I burned the steak, can this be saved?"`,

	3: `User disagrees
       - Expressions of disagreement with instructions or feedback
       - Examples:
         * "That's not right, the recipe said medium heat"
         * "No, I already added the eggs"
         * "I don't think that's correct"`,

	4: `User agrees
       - Confirmations and positive acknowledgments
       - Examples:
         * "Ok, got it"
         * "Yes, that looks right"
         * "I understand now"
         * "That worked, thank you"`,

	5: `User asks for repeating a previous interaction
       - Requests for information to be repeated
       - Examples:
         * "Can you say that again?"
         * "Please repeat the last instruction"
         * "How did you say about the ingredients for making the sauce?"`,

	6: `User asks for controlling the video playback
       - User requests to play, pause, or replay the video
       - Examples:
	   	 * "Play"
	   	 * "Pause"
		 * "Replay"
	   	 * "Play the video for this step"
         * "Replay xxx from the video"
         * "Can you show me how they did xxx from the video?"
         * "I need to play the kneading part again"`,

	7: `User asks for general questions
       - General cooking queries based on the video knowledge except for a specific steps or food states
       - Examples:
         * "What other ingredients do we need?"
		 * "How many steps are still left?"`,

	8: `User asks about food state related questions
       - Seeking visual description and verification of food states
       - Examples:
         * "Can you explain the current scene for me?"
         * "What are things around me now?"
         * "Where is the pan?"
         * "How does my steak look like now?"`,

	// 9: `User seeks to retrieve previous steps or interactions
    //    - Asking for recall of previous steps or actions
    //    - Examples:
    //      * "What's my last step?"
	//    	 * "What did I do before this?"
	// 	 * "What did I add last?"
	// 	 * "What are my last three steps?"`,

	10: `System detects food state misalignment
        - AI detects discrepancy between video and user's actions
        - Examples:
          * Detecting a wrong food state`,

	// 11: `System automatically detects a new action/step
    //     - AI recognizes transition to new cooking phase
    //     - Examples:
    //       * Detecting user has started mixing ingredients
    //       * Noticing transition to cooking phase
    //       * Identifying completion of preparation
    //       * Recognizing start of new recipe section`,

	12: `System detects missing previous steps
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
		0: 2,  // 0: User asks about step related questions; 2: Agent: Respond with step related questions
		2: 3,  // 2: User asks how to fix something; 3: Agent: Respond with how to fix
		7: 4,  // 7: User asks for general type of questions; 4: Agent: Respond with how to fix
		8: 1,  // 8: User asks about food state related questions; 1: Agent: Explain the current state of the food
		10: 3, // 10: System automatically detects food state misalignment; 3: Agent: Respond with how to fix
		12: 3, // 12: System automatically detects missing previous steps; 3: Agent: Respond with how to fix
		5: 0,  // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 0,  // 6: User asks for playing the segmented video; add-on state, stay where it is
		20: 0, // Timeout, stay in current state
	},
	1: {
		3: 5,  // 3: User disagrees; 5: Handling user disagreements
		1: 8,  // 1: User asks follow-up questions; 8: Agent: Follows up (with details) from the previous interaction
		4: 0,  // 4: User agrees; 0: Comparing video-reality alignment	
		5: 1,  // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 1,  // 6: User asks for playing the segmented video; add-on state, stay where it is
	},
	2: {
		3: 5,  // 3: User disagrees; 5: Handling user disagreements
		1: 8,  // 1: User asks follow-up questions; 8: Agent: Follows up (with details) from the previous interaction
		4: 0,  // 4: User agrees; 0: Comparing video-reality alignment
		5: 2,  // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 2,  // 6: User asks for playing the segmented video; add-on state, stay where it is
	},
	3: {
		3: 5,  // 3: User disagrees; 5: Handling user disagreements
		1: 8,  // 1: User asks follow-up questions; 8: Agent: Follows up (with details) from the previous interaction
		4: 0,  // 4: User agrees; 0: Comparing video-reality alignment
		5: 3,  // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 3,  // 6: User asks for playing the segmented video; add-on state, stay where it is
	},
	4: {
		3: 5,  // 3: User disagrees; 5: Handling user disagreements
		1: 8,  // 1: User asks follow-up questions; 8: Agent: Follows up (with details) from the previous interaction
		4: 0,  // 4: User agrees; 0: Comparing video-reality alignment
		5: 4,  // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 4,  // 6: User asks for playing the segmented video; add-on state, stay where it is
	},
	5: {
		4: 0, // 4: User agrees; 0: Comparing video-reality alignment
		3: 5, // 3: User disagrees; 5: Handling user disagreements
		5: 5, // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 5, // 6: User asks for playing the segmented video; add-on state, stay where it is
	},
	8: {
		4: 0, // 4: User agrees; 0: Comparing video-reality alignment
		3: 5, // 3: User disagrees; 5: Handling user disagreements
		1: 8, // 1: User asks follow-up questions; 8: Agent: Follows up (with details) from the previous interaction
		5: 8, // 5: User asks for repeating a previous interaction; add-on state, stay where it is
		6: 8, // 6: User asks for playing the segmented video; add-on state, stay where it is
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
	8: followUpWithDetails,
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