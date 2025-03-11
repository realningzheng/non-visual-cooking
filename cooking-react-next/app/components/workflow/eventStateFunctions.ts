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


/** State functions */
export const explainCurrentFoodState = async (				// state 1
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {

	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<INTERACTION MEMORY>:
		${interactionMemoryKv}
		
		<REALITY STREAM MEMORY>:
		${autoAgentResponseMemoryKv}
		
		<USER REQUEST>:
		${voiceInputTranscript}
		
		First, analyze the video knowledge to identify which segment(s) best answer the user's question. 
		Store the relevant segment index(es) under the key: <video_segment_index>.
		
		The user is unable to see, so they are asking about confirmations of visual elements in the cooking scene. 
		Please provide a detailed visual description that includes:
		
		1. Direct answer to the user's specific question first
		2. Clear visual details about the relevant items, including:
		   - Size (e.g., small, medium, large, dimensions if relevant)
		   - Color (be specific about shades and appearance)
		   - Shape (describe the form and contours)
		   - Position (describe location relative to other visible objects)
		   - Visual state (e.g., if food: raw, cooked, browning, etc.)
		
		Keep your response concise and focused on what the user can actually see in the current image. 
	`;
	console.log(`[state function] S1: explain current state prompt]`);
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

	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<INTERACTION MEMORY>:
		${interactionMemoryKv}
		
		<REALITY STREAM MEMORY>:
		${autoAgentResponseMemoryKv}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		The user is asking about a cooking step - this could be about the current step, a previous step, or an upcoming step. 
		The image provided shows the CURRENT cooking scene.

		First, analyze the video knowledge to identify which segment(s) best answer the user's question. 
		Store the relevant segment index(es) under the key: <video_segment_index>.

		Then, provide a precise and focused response that addresses these three elements:
		1. Step identification: Clearly name the step the user is asking about (e.g., "Chopping the garlic")
		2. Temporal information: Provide the expected duration of this step (in seconds or minutes) based on the video knowledge
		3. Impact explanation: Explain how this specific step affects the final dish (flavor, texture, etc.)

		Important guidelines:
		- Integrate these three elements naturally in your response without using numbered points or explicit headings
		- If the user is not asking about the current step, your response doesn't need to be based on the current visual information
		- Keep your response concise and directly relevant to what was asked
	`;
	console.log(`[state function] S2: step related questions prompt`);
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
	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<INTERACTION MEMORY>:
		${interactionMemoryKv}
		
		<REALITY STREAM MEMORY>:
		${autoAgentResponseMemoryKv}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		The user has encountered a cooking problem and needs guidance on how to fix it. The image shows the CURRENT cooking situation.

		First, analyze the video knowledge to identify which segment(s) contain the relevant solution. 
		Store the relevant segment index(es) under the key: <video_segment_index>.

		Then, provide a clear, actionable response that helps the user fix their cooking issue. Your response should:
		1. Briefly identify the specific cooking problem (e.g., "The sauce is separating" or "The vegetables are burning")
		2. Provide 1-2 immediate, concrete actions to fix the problem (e.g., "Lower the heat and add 2 tablespoons of water")
		3. If relevant, explain how to prevent this issue in the future (in 1 short sentence)

		Keep your response concise and executable.
	`;
	console.log(`[state function] S3: respond with how to fix prompt`);
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

	const prompt = `
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<INTERACTION MEMORY>:
		${interactionMemoryKv}
		
		<REALITY STREAM MEMORY>:
		${autoAgentResponseMemoryKv}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		First, analyze the video knowledge to identify which segment(s) best answer the user's question. 
		Store the relevant segment index(es) under the key: <video_segment_index>.

		Please repond to the user request in a concise manner and avoid extensive elaboration. 
		The image shows the CURRENT cooking scene.
	`;
	console.log(`[state function] S4: freeform response prompt`);
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
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<INTERACTION MEMORY>:
		${interactionMemoryKv.slice(-5)}
		
		<REALITY STREAM MEMORY>:
		${autoAgentResponseMemoryKv.slice(-5)}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		The user disagrees with your previous response and has provided additional information based on their sensory experience (tactile, sound, smell, etc.) or has requested a clarification.

		First, analyze the video knowledge to identify which segment(s) best answer the user's updated question or concern. 
		Store the relevant segment index(es) under the key: <video_segment_index>.

		Then, provide a revised response that:
		1. Acknowledges the user's disagreement or additional information respectfully
		2. Incorporates their tactile/sound/sensory feedback into your understanding of the situation
		3. Offers a corrected or refined explanation based on both the video knowledge and their firsthand experience
		4. If appropriate, explains any discrepancy between what the video shows and what the user is experiencing
		
		For ambiguous user requests, ask specific follow-up questions focused on sensory details:
		1. "What texture do you observe?"
		2. "What color/smell/sound indicates the issue?"
		3. "How does it compare to what you expected?"

		You are assisting low-vision users in real-time cooking, so AVOID asking the user to provide visual information.
		
		Keep your response concise, practical, and focused on helping the user succeed in their cooking task.
	`;
	console.log(`[state function] S5: handling user disagreements prompt`);
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
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		
		<INTERACTION MEMORY>:
		${interactionMemoryKv.slice(-5)}
		
		<REALITY STREAM MEMORY>:
		${autoAgentResponseMemoryKv.slice(-5)}
		
		<USER REQUEST>:
		${voiceInputTranscript}

		The user is asking for more details or clarification about your previous response. They generally agree with what you've shared but need additional information.

		First, analyze the video knowledge to identify which segment(s) best provide the additional details the user is seeking. 
		Store the relevant segment index(es) under the key: <video_segment_index>.

		Then, provide an enhanced response that:
		1. Briefly acknowledges what was previously explained (in 1 sentence)
		2. Provides the specific additional details the user is requesting
		3. Focuses on sensory information that would be helpful for a low-vision user (textures, sounds, smells, timing cues)
		
		For ambiguous user requests, ask specific follow-up questions focused on sensory details:
		1. "What texture do you observe?"
		2. "What color/smell/sound indicates the issue?"
		3. "How does it compare to what you expected?"

		Keep your response practical and concise, expanding only on the specific aspects the user has asked about.
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
	interactionMemoryKv: { [key: string]: any },
) => {
	const prompt = `
		Retrieve the one, and only one, of the most relevant part from previous interactions based on user request:
		<PREVIOUS INTERACTION>
		${JSON.stringify(interactionMemoryKv)}
		
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