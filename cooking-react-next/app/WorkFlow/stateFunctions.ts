import OpenAI from 'openai';
import axios from "axios";
import credential from '../../secret.json';
// hardcoded segmented sentence list
import transcriptSentenceList from '../data/rwYaDqXFH88_sentence.json';
import { systemPrompt } from '../prompt';

const apiKey = credential.OPENAI_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });


// export const basePrompt = `
// 	- You are an AI agent responsible for helping low-vision users cook in the kitchen.
// 	- Please help the user by answering their questions and guiding them through the cooking process based on the video knowledge.
// 	- 'User\'s request is provided after the tag <USER REQUEST>.'
// 	- Be kind and helpful.
// 	- You answer should be as precise as possible, as blind people need to grasp the KEY information as quickly as possible.
// `

// State functions
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
	console.log(`[state 1: explain current state prompt]: ${prompt}`);
	const response = await callChatGPT(prompt, [realityImageBase64]);
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
		${useInteractionMemoryFlag ? 'Interaction memory is the previous user-agent interaction memory, it is useful for some of the requests given by the user but not all of them. Use it as needed.' : ''}
		${useInteractionMemoryFlag ? 'User\'s memory is provided after the tag <INTERACTION MEMORY>.' : ''}
		${useInteractionMemoryFlag ? '<INTERACTION MEMORY>:' : ''}
		${useInteractionMemoryFlag ? interactionMemoryKv : ''}
		${useAutoAgentResponseMemoryFlag ? 'Auto Agent response memory is the store of previous automatic agent response.' : ''}
		${useAutoAgentResponseMemoryFlag ? 'Auto Agent response memory is provided after the tag <AUTO AGENT RESPONSE MEMORY>.' : ''}
		${useAutoAgentResponseMemoryFlag ? '<AUTO AGENT RESPONSE MEMORY>:' : ''}
		${useAutoAgentResponseMemoryFlag ? autoAgentResponseMemoryKv : ''}
		<USER REQUEST>
		${voiceInputTranscript}
		To help me answer this question, you first revisit the video knowledge and find out which segments are relevant to this question.
		Picking up segments evenly from the beginning, middle and end of the video knowledge.
		Remember and return the indices of all relevant segments.
		Only return the <Index> of the segments.
		Then, please use natural languaguage to respond to my question regarding the step in the following aspects:
		1. The name to step (e.g. "Cutting the onion")
		2. An expected duration of the step in seconds or minutes from the video knowledge
		3. How the step will influence the outcome of the dish.
		However, do not explicitly say 'step name ...; expected duration...; influence on the outcome...',
	`;
	console.log(`[state 2: step related questions prompt]: ${prompt}`);
	const response = await callChatGPT(prompt, [realityImageBase64]);
	console.log(response);
	return response.response;
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
		Please tell user how to fix the current problem based on the video knowledge and memory from previous steps.
		Your response should include the following aspects:
		1. A short description of the current problem
		2. Tell the user about the immediate next step to fix this problem
	`;
	console.log(`[state 3: respond with how to fix prompt]: ${prompt}`);
	const response = await callChatGPT(prompt);
	return response.response;
};


export const freeformResponse = async (				// state 4
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
	console.log(`[state 4: freeform response prompt]: ${prompt}`);
	const response = await callChatGPT(prompt);
	return response.response;
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
	console.log(`[state 5: handling user disagreements prompt]: ${prompt}`);
	const response = await callChatGPT(prompt);
	return response.response;
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
		Please replay the relevant parts from the video knowledge that are related to the user's request.
	`;
	console.log(`[state 6: replay relevant parts from videos prompt]: ${prompt}`);
	const response = await findSentenceFromTranscript(prompt);
	return JSON.stringify(response.video_segment_index);
};


export const retrievePreviousStepsOrInteractions = async (	// state 7
	videoKnowledgeInput: string,
	realityImageBase64: string,
	voiceInputTranscript: string,
	interactionMemoryKv: { [key: string]: any },
	autoAgentResponseMemoryKv: { [key: string]: any }
) => {
	console.log(`[state 7: retrieve previous steps or interactions]: ${voiceInputTranscript}`);
	const prompt = `
		Interaction memory:
		${interactionMemoryKv}
		Agent initiated response memory:
		${autoAgentResponseMemoryKv}
		Please respond to the user's question related to his/her previous steps: "${voiceInputTranscript}".
	`;
	console.log(`[state 7: retrieve previous steps or interactions prompt]: ${prompt}`);
	const response = await callChatGPT(prompt);
	return response.response;
};


/** Async GPT call */
export async function callChatGPT(prompt: string, imageUrls: string[] = []): Promise<{ response: string, video_segment_index: number[] }> {
	let gptResponse = { response: "", video_segment_index: [] };
	try {
		// Construct content array with text prompt and any provided images
		const content: Array<{ type: string } & Record<string, any>> = [
			{ type: "text", text: prompt }
		];

		// Add any image URLs to the content array
		if (imageUrls.length > 0) {
			imageUrls.forEach(url => {
				if (url.length > 0) {
					content.push({
						type: "image_url",
						image_url: {
							url: url
						}
					});
				}
			});
		}

		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			tools: [{
				type: "function",
				function: {
					name: "respond_to_step_related_questions_and_provide_video_clip_index",
					description: "Respond with step related questions and provide video clip index from the video knowledge",
					parameters: {
						type: "object",
						properties: {
							response: {
								type: "string",
								description: "The response text"
							},
							video_segment_index: {
								type: "array",
								items: { type: "number" },
								description: "Array of sentence IDs that are relevant"
							}
						},
						required: ["response", "video_segment_index"]
					}
				}
			}],
			tool_choice: 'auto',
			messages: [
				{
					role: "system",
					content: systemPrompt
				},
				{
					role: "user",
					content: content as any[]
				}
			],
			max_tokens: 500,
		});

		// Handle both tool_calls and direct content responses
		if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
			return JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
		} else {
			gptResponse.response = response.choices[0].message.content || "";
		}
	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Error calling GPT-4 API:", error.response?.data);
		} else {
			console.error("Unknown error:", error);
		}
	}
	return gptResponse;
}


export async function findSentenceFromTranscript(prompt: string) {
	const importantSentencesPrompt = "This is the transcript of video that teaches blind people how to cook. \n" +
		`Given the transcript, please tell me which sentences are relevant to ${prompt}, elusive for non-expert audiences to understand and are better with a visual explanation. \n` +
		"You are required to pick up sentences evenly from the beginning, middle and end of the transcript. \n" +
		"The transcript is given as a list of sentences with ID. Only return the sentence IDs to form the great version. \n" +
		"Do not include full sentences in your reply. Only return a list of IDs. Return all relevant sentences. \n" +
		"Use the following format: `{'gptResponse': [1, 4, 45, 100]}`. \n" +
		"Make sure the returned format is a list that can be parsed by Json. \n" +
		transcriptSentenceList.map((s) => `${s["sentenceIndex"]}: ${s["text"]}`).join("\n\n");

	try {
		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "user",
					content: importantSentencesPrompt,
				}
			],
			tools: [{
				type: "function",
				function: {
					name: "get_relevant_sentences",
					description: "Get the IDs of relevant sentences from the transcript as gpt response",
					parameters: {
						type: "object",
						properties: {
							response: {
								type: "string",
								description: "The response text"
							},
							video_segment_index: {
								type: "array",
								items: { type: "number" },
								description: "Array of sentence IDs that are relevant"
							}
						},
						required: ["response", "video_segment_index"]
					}
				}
			}],
			tool_choice: { type: "function", function: { name: "get_relevant_sentences" } },
			max_tokens: 1500,
		});

		// Handle both tool_calls and direct content responses
		if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
			return JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
		}

		return { "gptResponse": [] };

	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Error calling GPT-4 API:", error.response?.data);
		} else {
			console.error("Unknown error:", error);
		}
		return { "gptResponse": [] };
	}
}