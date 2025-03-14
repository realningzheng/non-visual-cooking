import {
	respondAndProvideVideoSegmentIndex,
	retrievePreviousInteraction,
	determinePlaySegmentedVideo
} from './utils';
import {
	systemPromptDefault,
	systemPromptRetrievePreviousInteraction,
	systemPromptUserFollowUp,
	systemPromptErrorHandling
} from '../../prompts';
import { CombinedMemoryItem } from '@/app/types/common';


/** State functions */
export const explainCurrentFoodState = async (				// state 1
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {

	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<MEMORY>:
		${combinedMemory.map(item => `[${item.timestamp}] [${item.type}] ${JSON.stringify(item.content)}`).join('\n')}
		
		<USER REQUEST>:
		${voiceInputTranscript}
		
		First, analyze the video knowledge to identify which segment(s) best answer the user's question. 
		Store the relevant segment index(es) under the key: <video_segment_index> from the <VIDEO KNOWLEDGE>.
		
		The user is unable to see, so provide a concise visual description focusing on:
		1. FIRST, directly answer the specific question in 1-2 sentences
		2. BRIEFLY describe relevant visual details (size, color, shape, position, state)
		3. Limit your entire response to 3-5 sentences maximum
		4. Use simple, direct language without elaboration or pleasantries
	`;
	console.log(`[state function] S1: explain current state prompt]`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const respondWithStepRelatedQuestions = async (		// state 2
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {

	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<MEMORY>:
		${combinedMemory.map(item => `[${item.timestamp}] [${item.type}] ${JSON.stringify(item.content)}`).join('\n')}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		First, analyze the video knowledge to identify which segment(s) best answer the user's question. 
		Store the relevant segment index(es) under the key: <video_segment_index> from the <VIDEO KNOWLEDGE>

		Provide a brief response about the cooking step with these 3 elements:
		1. Step name (1 sentence)
		2. Duration (based on the video knowledge if available, otherwise tell the user the duration of the step is not mentioned in the video)
		3. Impact on dish (1-3 short sentences)
		
		Keep entire response under 3-5 sentences. No elaboration or pleasantries.
	`;
	console.log(`[state function] S2: step related questions prompt`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const respondWithHowToFix = async (				// state 3
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {
	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<MEMORY>:
		${combinedMemory.map(item => `[${item.timestamp}] [${item.type}] ${JSON.stringify(item.content)}`).join('\n')}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		First, analyze the video knowledge to identify which segment(s) contain the relevant solution. 
		Store the relevant segment index(es) under the key: <video_segment_index> from the <VIDEO KNOWLEDGE>

		Provide an immediate solution:
		1. Problem identification (1-2 sentence)
		2. Explain why the problem happens (1-2 sentence)
		3. 1-2 specific actions to fix (use imperative form: "Reduce heat. Add water.")

		
		Keep entire response about 3-5 sentences. No explanations or pleasantries.
	`;
	console.log(`[state function] S3: respond with how to fix prompt`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const freeformResponse = async (				// state 4
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {

	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<MEMORY>:
		${combinedMemory.map(item => `[${item.timestamp}] [${item.type}] ${JSON.stringify(item.content)}`).join('\n')}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		First, analyze the video knowledge to identify which segment(s) best answer the user's question. 
		Store the relevant segment index(es) under the key: <video_segment_index> from the <VIDEO KNOWLEDGE>

		Response requirements:
		1. Start with direct answer to user's specific question
		2. Use maximum 3-5 short sentences total
		3. No elaboration and pleasantries
		4. Use simple, direct language only
	`;
	console.log(`[state function] S4: freeform response prompt`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptDefault, prompt, [realityImageBase64]);
	return response;
};


export const handlingUserDisagreements = async (		// state 5
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {
	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<MEMORY>:
		${combinedMemory.slice(-5).map(item => `[${item.timestamp}] [${item.type}] ${JSON.stringify(item.content)}`).join('\n')}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		First, analyze the video knowledge to identify which segment(s) best answer the user's updated question or concern. 
		Store the relevant segment index(es) under the key: <video_segment_index> from the <VIDEO KNOWLEDGE>

		Provide an immediate correction:
		1. BRIEFLY summarize the reason why the previous response (from conversation items in the <MEMORY>) is declined by the user based on their current provided additional details (from the <USER REQUEST>) (1-2 sentence)
		2. Give 1-2 specific actions based on the additional details and previous response (1-2 sentence)
		3. Use maximum 3-5 sentences total, no apologies, elaboration and pleasantries.
		
		For truly ambiguous requests, ask ONE specific follow-up about texture, sound, or smell.
	`;
	console.log(`[state function] S5: handling user disagreements prompt`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptErrorHandling, prompt, [realityImageBase64]);
	return response;
};


export const followUpWithDetails = async (   // state 8
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {
	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<MEMORY>:
		${combinedMemory.slice(-5).map(item => `[${item.timestamp}] [${item.type}] ${JSON.stringify(item.content)}`).join('\n')}
		
		<USER REQUEST>:
		${voiceInputTranscript}
        The user is asking for more details or clarification about your previous response (from conversation items in the <MEMORY>). 
		They generally agree with what you've shared but need additional information.
		
		First, analyze the video knowledge to identify which segment(s) best provide the additional details the user is seeking. 
		Store the relevant segment index(es) under the key: <video_segment_index> from the <VIDEO KNOWLEDGE>
		Improve your previous response based on the additional details provided by the user.
		Avoid repeating the same information from the previous response.
		Limit response to 3-5 SHORT sentences maximum.
		Avoid elaboration and pleasantries.
		For truly ambiguous requests, ask ONE specific follow-up about texture, sound, or smell.
		
	`;
	console.log(`[state function] S8: follow up with details prompt`);
	const response = await respondAndProvideVideoSegmentIndex(systemPromptUserFollowUp, prompt, [realityImageBase64]);
	return response;
};


/** Event functions specifically for:
 * event 5: repeat previous interaction
 * event 6: play segmented video
*/
export const repeatPreviousInteraction = async (			// event 5: retrieve previous interactions
	voiceInputTranscript: string,
	combinedMemory: CombinedMemoryItem[]
) => {
	const prompt = `
		Retrieve the one, and only one, of the most relevant part from previous interactions based on user request:
		<PREVIOUS INTERACTION>
		${combinedMemory.filter(item => item.type === 'conversation').map(item => `[${item.timestamp}] ${JSON.stringify(item.content)}`).join('\n')}
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