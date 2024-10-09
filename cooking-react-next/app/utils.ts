import axios from 'axios';
import OpenAI from 'openai';
// Hardcoded data for now
// import transriptSentenceList from './data/cooking_steak_sentence.json';
import credential from '../secret.json';

const apiKey = credential.OPENAI_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });


// export async function findSentenceFromTranscript(prompt: string) {

// 	const importantSentencesPrompt = "This is the transcript of video that teaches blind people how to cook. \n" +
// 		`Given the transcript, please tell me which sentences are relevant to ${prompt}, elusive for non-expert audiences to understand and are better with a visual explanation. \n` +
// 		"You are required to pick up sentences evenly from the beginning, middle and end of the transcript. \n" +
// 		"The transcript is given as a list of sentences with ID. Only return the sentence IDs to form the great version. \n" +
// 		"Do not include full sentences in your reply. Only return a list of IDs. Do not return more than 5 sentences. \n" +
// 		"Use the following format: `{'sentence_IDs': [1, 4, 45, 100]}`. \n" +
// 		"Make sure the returned format is a list that can be parsed by Json. \n" +
// 		transriptSentenceList.map((s) => `${s["sentenceIndex"]}: ${s["text"]}`).join("\n\n");
// 	let gptResponse: { "sentence_IDs": number[] } = { "sentence_IDs": [] };

// 	try {
// 		const response = await openai.chat.completions.create({
// 			model: "gpt-4-turbo",
// 			response_format: { "type": "json_object" },
// 			messages: [
// 				{
// 					role: "user",
// 					content: [
// 						{ type: "text", text: `${importantSentencesPrompt}` },
// 					],
// 				},
// 			],
// 			max_tokens: 1500,
// 		});
		
// 		if (response.choices[0]['message']['content']) {
// 			gptResponse = JSON.parse(response.choices[0]['message']['content']);
// 		}

// 	} catch (error) {
// 		if (axios.isAxiosError(error)) {
// 			console.error("Error calling GPT-4 API:", error.response?.data);
// 		} else {
// 			console.error("Unknown error:", error);
// 		}
// 	}

// 	return gptResponse;
// }

export async function callGpt4V(prompt: string, imageURLList: string[]): Promise<{"gptResponse":string, "formattedResponse":any}> {
	let gptResponse = "";
	let formattedResponse = "";

	try {
		console.log(prompt);
		const response = await openai.chat.completions.create({
			model: "gpt-4-turbo",
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: `${prompt}` },
						...imageURLList.map(url => ({
							type: "image_url" as const, // Explicitly stating the type as a constant
							image_url: {
								"url": url
							},
						})),
					],
				},
			],
			max_tokens: 1500,
		});

		if (response.choices[0]['message']['content']) {
			gptResponse = response.choices[0]['message']['content'];
			// format GPT response to json
			formattedResponse = await formatGPTResponseToJson(gptResponse);
		}

	} catch (error) {
		if (axios.isAxiosError(error)) {
			console.error("Error calling GPT-4 API:", error.response?.data);
		} else {
			console.error("Unknown error:", error);
		}
	}

	return {"gptResponse": gptResponse, "formattedResponse": formattedResponse};
}


export async function formatGPTResponseToJson(freeFormMessage: string): Promise<string> {
	let jsonResponse = "";
	try {
		const response = await openai.chat.completions.create({
			model: "gpt-3.5-turbo-0125",
			tools: [
				{
					"type": "function",
					"function": {
						"name": "get_entity_info",
						"description": "Get the required entity info from the input message.",
						"parameters": {
							"type": "object",
							"properties": {
								"entity": {
									"type": "string",
									"description": "The main object being described in the input message. e.g. person, pot, steak, computer, desk, wok, fork, etc.",
								},
								"description": {
									"type": "string",
									"description": "A few sentences to describe the entity. e.g. A person is standing in front of a desk, a pot is placed on the stove, a steak is being cooked in the pan, etc.",
								},
								"size": {
									"type": "string",
									"description": "The size of the entity being described, use key words or sentences, consider the relative position to the context. e.g. small, big, large, tiny, etc.",
								},
								"color": {
									"type": "string",
									"description": "The color of the entity being described, use key words or sentences. e.g. red, Slate, Cerulean, tanned, Golden Brown, crispy outside and tender inside etc.",
								},
								"location": {
									"type": "string",
									"description": "Using a few sentences to describe the position of the entiry. e.g. on the left side of the table, in the middle of the room, on the top of the shelf, etc.",
								},

							},
							"required": ["entity", "description", "size", "color", "location"]
						},
					}
				}
			],
			messages: [
				{
					role: "system",
					content: "You are a helpful assistant designed to get specific information from the input and output as JSON.",
				},
				{
					role: "user",
					content: freeFormMessage,
				},
			],
			max_tokens: 1500,
		});

		if (response.choices[0]['message']['tool_calls']?.[0]['function']['arguments']) {
			jsonResponse = response.choices[0]['message']['tool_calls']?.[0]['function']['arguments'];
		}

	} catch (error) {
		console.error("Error formatting GPT response to JSON:", error);
	}

	return jsonResponse;
}