import { callChatGPT } from './utils';
import { systemPromptStateFunctions } from '../prompt';


export const comparingVideoRealityAlignment = async (	// state 0
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const timeout = 1000;
	await new Promise(resolve => setTimeout(resolve, timeout));

	console.log(`[executing]: Comparing video-reality alignment (simulated timeout: ${timeout}ms)`);
	// TODO: compare video and reality
	// 10: "System automatically detects misalignment",
	// 11: "System automatically detects a new action/step",
	// 12: "System automatically detects missing previous steps",
	// 20: "System automatically evaluates reality"
	// const prompt = `
	// 	${basePrompt}
	// 	Video knowledge:
	// 	${videoKnowledgeInput}
	// 	Memory:
	// 	${memory}
	// 	Based on the reality image provided and the video knowledge and memory, please select the most appropriate category:
	// 	10: "System automatically detects misalignment",
	//     11: "System automatically detects a new action/step",
	//     12: "System automatically detects missing previous steps",
	//     20: "System automatically evaluates reality"
	// 	Please reply ONLY the index of the most appropriate category.
	// `;
	// const response = await callChatGPT(prompt, [realityImageBase64]);
	// return response.gptResponse;
	return `<System automatically compares video-reality alignment> (simulated timeout: ${timeout}ms)`;
};


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
	const response = await callChatGPT(systemPromptStateFunctions, prompt, [realityImageBase64]);
	return response.response;
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
	const response = await callChatGPT(systemPromptStateFunctions, prompt, [realityImageBase64]);
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
	const response = await callChatGPT(systemPromptStateFunctions, prompt, [realityImageBase64]);
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
	const response = await callChatGPT(systemPromptStateFunctions, prompt, [realityImageBase64]);
	return response;
};


export const handlingUserDisagreements = async (		// state 5
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
	`;
	console.log(`[state 5: handling user disagreements prompt]`);
	const response = await callChatGPT(systemPromptStateFunctions, prompt);
	return response;
};


export const replayRelevantPartsFromVideos = async (	// state 6
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const prompt = `
		<VIDEO KNOWLEDGE>
		${videoKnowledgeInput}
		<USER REQUEST>
		${voiceInputTranscript}
		Please replay the relevant parts from the video knowledge that are related to my request.
		You should pick up segments evenly from the beginning, middle and end of the video knowledge.
		Respond with only the index(es) of those segments.
	`;
	console.log(`[state 6: replay relevant parts from videos prompt]`);
	const response = await callChatGPT(systemPromptStateFunctions, prompt);
	
	return response;
};


export const retrievePreviousStepsOrInteractions = async (	// state 7
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	const prompt = `
		Interaction memory:
		${interactionMemoryKv}
		Agent initiated response memory:
		${autoAgentResponseMemoryKv}
		Please respond to the user's question related to his/her previous steps: "${voiceInputTranscript}".
	`;
	console.log(`[state 7: retrieve previous steps or interactions prompt]`);
	const response = await callChatGPT(systemPromptStateFunctions, prompt);
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
		<USER REQUEST>
		${voiceInputTranscript}
	`;
	console.log(`[state 8: follow up with details prompt]`);
	const response = await callChatGPT(systemPromptStateFunctions, prompt);
	return response;
};