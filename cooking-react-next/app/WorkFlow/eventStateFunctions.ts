import {
	respondAndProvideVideoSegmentIndex,
	retrievePreviousInteraction,
	determinePlaySegmentedVideo
} from './utils';
import {
	systemPromptRetrievePreviousInteraction,
	systemPromptDefault,
	systemPromptCtxFollowUp,
	systemPromptErrorHandling
} from '../prompt';


/** State functions */
// state 0 is agent-initiated
// export const comparingVideoRealityAlignment = async (	
// 	videoKnowledgeInput: string,
// 	realityImageBase64: string,
// 	voiceInputTranscript: string,
// 	interactionMemoryKv: { [key: string]: any },
// 	autoAgentResponseMemoryKv: { [key: string]: any }
// ) => {
// 	const timeout = 1000;
// 	await new Promise(resolve => setTimeout(resolve, timeout));

// 	console.log(`[executing]: Comparing video-reality alignment (simulated timeout: ${timeout}ms)`);
// 	// TODO: compare video and reality
// 	// 10: "System automatically detects misalignment",
// 	// 11: "System automatically detects a new action/step",
// 	// 12: "System automatically detects missing previous steps",
// 	// 20: "System automatically evaluates reality"
// 	// const prompt = `
// 	// 	${basePrompt}
// 	// 	Video knowledge:
// 	// 	${videoKnowledgeInput}
// 	// 	Memory:
// 	// 	${memory}
// 	// 	Based on the reality image provided and the video knowledge and memory, please select the most appropriate category:
// 	// 	10: "System automatically detects misalignment",
// 	//     11: "System automatically detects a new action/step",
// 	//     12: "System automatically detects missing previous steps",
// 	//     20: "System automatically evaluates reality"
// 	// 	Please reply ONLY the index of the most appropriate category.
// 	// `;
// 	// const response = await callChatGPT(prompt, [realityImageBase64]);
// 	// return response.gptResponse;
// 	return `<System automatically compares video-reality alignment> (simulated timeout: ${timeout}ms)`;
// };


export const explainCurrentFoodState = async (				// state 1
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const useVideoKnowledgeFlag = false;
	const useInteractionMemoryFlag = false;
	const useAutoAgentResponseMemoryFlag = false;
	const useVideoAndMemoryCtx = false;

	const prompt = `
		${useVideoKnowledgeFlag && useVideoAndMemoryCtx ? '<VIDEO KNOWLEDGE>:' : ''}
		${useVideoKnowledgeFlag && useVideoAndMemoryCtx ? videoKnowledgeInput : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? 'Interaction memory is the previous user-agent interaction memory, it is useful for some of the requests given by the user but not all of them. Use it as needed.' : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? 'User\'s memory is provided after the tag <INTERACTION MEMORY>.' : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? '<INTERACTION MEMORY>:' : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? interactionMemoryKv : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? 'Auto Agent response memory is the store of previous automatic agent response.' : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? 'Auto Agent response memory is provided after the tag <AUTO AGENT RESPONSE MEMORY>.' : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? '<AUTO AGENT RESPONSE MEMORY>:' : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? autoAgentResponseMemoryKv : ''}
		<USER REQUEST>:
		${voiceInputTranscript}
		Please describe the current cooking state in the following aspects:
		1. a short general description of the current state
		2. the size, color, and relative location of the main food item
	`;
	console.log(`[state 1: explain current state prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const respondWithStepRelatedQuestions = async (		// state 2
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const useVideoKnowledgeFlag = true;
	const useInteractionMemoryFlag = false;
	const useAutoAgentResponseMemoryFlag = false;

	const prompt = `
		${useVideoKnowledgeFlag ? '<VIDEO KNOWLEDGE>:' : ''}
		${useVideoKnowledgeFlag ? videoKnowledgeInput : ''}
		<USER REQUEST>
		${voiceInputTranscript}
		${useInteractionMemoryFlag && useAutoAgentResponseMemoryFlag ? 'I also provide you with some previous steps and interactions, please use them as needed.' : ''}
		${useInteractionMemoryFlag ? 'Interaction memory is the previous user-agent interaction memory, it is useful for some of the requests given by the user but not all of them. Use it as needed.' : ''}
		${useInteractionMemoryFlag ? 'User\'s memory is provided after the tag <INTERACTION MEMORY>.' : ''}
		${useInteractionMemoryFlag ? '<INTERACTION MEMORY>:' : ''}
		${useInteractionMemoryFlag ? interactionMemoryKv : ''}
		${useAutoAgentResponseMemoryFlag ? 'Auto Agent response memory is the store of previous automatic agent response.' : ''}
		${useAutoAgentResponseMemoryFlag ? 'Auto Agent response memory is provided after the tag <AUTO AGENT RESPONSE MEMORY>.' : ''}
		${useAutoAgentResponseMemoryFlag ? '<AUTO AGENT RESPONSE MEMORY>:' : ''}
		${useAutoAgentResponseMemoryFlag ? autoAgentResponseMemoryKv : ''}
		To help me answer this question, you first look at the video knowledge and find out which segments can possibly answer my question.
		Remember the index(es) of all those segments under the key: <video_segment_index>.
		Make sure you ONLY return the <Index> of the segments.
		Then, please use natural languaguage to respond to my question regarding the step in the following aspects:
		1. The name to step (e.g. "Cutting the onion")
		2. An expected duration of the step in seconds or minutes from the video knowledge
		3. How the step will influence the outcome of the dish.
		However, do not explicitly say 'step name ...; expected duration...; influence on the outcome...',
		Make your response precise and avoid extensive elaboration.
	`;
	console.log(`[state 2: step related questions prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const respondWithHowToFix = async (				// state 3
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const useVideoKnowledgeFlag = false;
	const useInteractionMemoryFlag = false;
	const useAutoAgentResponseMemoryFlag = false;
	const useVideoAndMemoryCtx = false;

	const prompt = `
		${useVideoKnowledgeFlag && useVideoAndMemoryCtx ? '<VIDEO KNOWLEDGE>:' : ''}
		${useVideoKnowledgeFlag && useVideoAndMemoryCtx ? videoKnowledgeInput : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? 'Interaction memory is the previous user-agent interaction memory, it is useful for some of the requests given by the user but not all of them. Use it as needed.' : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? 'User\'s memory is provided after the tag <INTERACTION MEMORY>.' : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? '<INTERACTION MEMORY>:' : ''}
		${useInteractionMemoryFlag && useVideoAndMemoryCtx ? interactionMemoryKv : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? 'Auto Agent response memory is the store of previous automatic agent response.' : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? 'Auto Agent response memory is provided after the tag <AUTO AGENT RESPONSE MEMORY>.' : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? '<AUTO AGENT RESPONSE MEMORY>:' : ''}
		${useAutoAgentResponseMemoryFlag && useVideoAndMemoryCtx ? autoAgentResponseMemoryKv : ''}
		<USER REQUEST>
		${voiceInputTranscript}
		To help me answer this question, you first look at the video knowledge and find out which segments can possibly answer my question.
		Remember the index(es) of all those segments under the key: <video_segment_index>.
		Make sure you ONLY return the <Index> of the segments.
		Then, please tell me how to fix the current problem based on the video knowledge and memory from previous steps in natural language.
		Your response should include:
		1. A short description of the current problem
		2. Tell me about the immediate next step to fix this problem
	`;
	console.log(`[state 3: respond with how to fix prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const freeformResponse = async (				// state 4
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const useInteractionMemoryFlag = false;
	const useAutoAgentResponseMemoryFlag = false;

	const prompt = `
		'<VIDEO KNOWLEDGE>' 
		${videoKnowledgeInput}
		<USER REQUEST>
		${voiceInputTranscript}
		${useInteractionMemoryFlag && useAutoAgentResponseMemoryFlag ? 'I also provide you with some previous steps and interactions, please use them as needed.' : ''}
		${useInteractionMemoryFlag ? 'Interaction memory is the previous user-agent interaction memory, it is useful for some of the requests given by the user but not all of them. Use it as needed.' : ''}
		${useInteractionMemoryFlag ? 'User\'s memory is provided after the tag <INTERACTION MEMORY>.' : ''}
		${useInteractionMemoryFlag ? '<INTERACTION MEMORY>:' : ''}
		${useInteractionMemoryFlag ? interactionMemoryKv : ''}
		${useAutoAgentResponseMemoryFlag ? 'Auto Agent response memory is the store of previous automatic agent response.' : ''}
		${useAutoAgentResponseMemoryFlag ? 'Auto Agent response memory is provided after the tag <AUTO AGENT RESPONSE MEMORY>.' : ''}
		${useAutoAgentResponseMemoryFlag ? '<AUTO AGENT RESPONSE MEMORY>:' : ''}
		${useAutoAgentResponseMemoryFlag ? autoAgentResponseMemoryKv : ''}
		To help me answer this question, you first look at the video knowledge and find out which segments can possibly answer my question.
		Remember the index(es) of all those segments under the key: <video_segment_index>.
		Make sure you ONLY return the <Index> of the segments.
		Then, based on the information from the selected video segments, use natural languaguage to respond to my question under the key: <response>.
		Make your response precise and avoid extensive elaboration.
	`;
	console.log(`[state 4: freeform response prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const handlingUserDisagreements = async (		// state 5
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const prompt = `
		<VIDEO KNOWLEDGE>
		${videoKnowledgeInput}
		<INTERACTION HISTORY>
		${JSON.stringify(interactionMemoryKv)}
		<USER REQUEST>
		${voiceInputTranscript}
		Please provide both your response and the index of the video segment that is relevant to my question.
	`
	console.log(`[state 5: handling user disagreements prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptErrorHandling, prompt, [realityImageBase64]);
	return response;
};


export const followUpWithDetails = async (   // state 8
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const prompt = `
		<VIDEO KNOWLEDGE>
		${videoKnowledgeInput}
		<INTERACTION HISTORY>
		${JSON.stringify(interactionMemoryKv)}
		<USER REQUEST>
		${voiceInputTranscript}
		Please provide both your response and the index of the video segment that is relevant to my question.
	`;
	console.log(`[state 8: follow up with details prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptCtxFollowUp, prompt, [realityImageBase64]);
	return response;
};


/** Event functions specifically for:
 * event 5: repeat previous interaction
 * event 6: play segmented video
*/
export const repeatPreviousInteraction = async (			// event 5: retrieve previous interactions
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
) => {
	const prompt = `
		Retrieve the one, and only one, of the most relevant part from previous interactions based on user request:
		<PREVIOUS INTERACTION>
		${JSON.stringify(interactionMemoryKv)}
		<USER REQUEST>
		${voiceInputTranscript}
	`;
	console.log(`[event 5: repeat previous interaction prompt]`);
	const response = await retrievePreviousInteraction(
		systemPromptRetrievePreviousInteraction,
		prompt
	);
	return response;
}


export const getPlaySegmentedVideoFlag = async (				// event 6: control segmented video playback
	voiceInputTranscript: string,
) => {
	const prompt = `
		<USER REQUEST>
		Determine if the following request is to play the video, pause the video, or replay from the beginning of the video:
		${voiceInputTranscript}
	`;
	console.log(`[event 6: play segmented video flag prompt]`);
	const response = await determinePlaySegmentedVideo(
		`You are a helpful assistant to determine if the user request is to play the video, pause the video, or replay from the beginning of the video.
		return 0 if they want to pause the video, 1 if they want to play the video, 2 if they want to replay from the beginning of the video.
		user request is given after the tag <USER REQUEST>
		`,
		prompt
	);
	return response;
}