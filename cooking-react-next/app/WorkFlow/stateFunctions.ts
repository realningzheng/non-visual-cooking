import OpenAI from 'openai';
import axios from "axios";
import credential from '../../secret.json';
// hardcoded segmented sentence list
import transcriptSentenceList from '../data/rwYaDqXFH88_sentence.json';

const apiKey = credential.OPENAI_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });


export const basePrompt = `
	System settings:
	Tool use: enabled.

	Instructions:
	- You are an AI agent responsible for helping low-vision users cook in the kitchen.
	- The user has provided a video knowledge in JSON format which contains multimodal information on how to correctly cook in the kitchen.
	- Please help the user by answering their questions and guiding them through the cooking process based on the video knowledge.
	- Video knowledge is provided in JSON format, after the tag <VIDEO KNOWLEDGE>.
	- User's request is provided after the tag <USER REQUEST>.
	- Be kind, helpful, and precise for your answers
	- It is okay to ask the user questions
	- Use tools and functions you have available liberally, it is part of the training apparatus
	- Be open to exploration and conversation

`
// State functions
export const comparingVideoRealityAlignment = async (	// state 0
    videoKnowledgeInput: string,
    realityImageBase64: string
    // TODO: memory: string
) => {
    // await for 3 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("[state 0]: Comparing video-reality alignment");
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
    return '<System automatically compares video-reality alignment>';
};


export const explainCurrentState = async (				// state 1
    videoKnowledgeInput: string,
    realityImageBase64: string,
    voiceInputTranscript: string
) => {
    // TODO: extract current state
    const prompt = `
		${basePrompt}
		Video knowledge:
		${videoKnowledgeInput}
		User request is:
		${voiceInputTranscript}
		Please describe in the following properties:
		1. <general>: a general description of the current state
		2. <explanation>: a detailed explanation of the current state
		3. <size>: the size of the entity being described
		4. <color>: the color of the entity being described
		5. <location>: the relative position of the entity being described
	`;
    const shortPrompt = `
		User request is:
		${voiceInputTranscript}
		Please describe in the following properties:
		1. <general>: a general description of the current state
		2. <explanation>: a detailed explanation of the current state
		3. <size>: the size of the entity being described
		4. <color>: the color of the entity being described
		5. <location>: the relative position of the entity being described
	`;
    console.log(`[state 1: explain current state prompt]: ${shortPrompt}`);
    const response = await callChatGPT(shortPrompt, [realityImageBase64]);
    return response.gptResponse;
};


export const explainCurrentStep = async (		// state 2
    videoKnowledgeInput: string,
    realityImageBase64: string,
    voiceInputTranscript: string
) => {
    const prompt = `
		<USER REQUEST>
		${voiceInputTranscript}
	`;
    const fullPrompt = `
		${basePrompt}
		<VIDEO KNOWLEDGE>:
		${videoKnowledgeInput}
		${prompt}
	`;
    console.log(`[state 2: explain current step prompt]: ${prompt}`);
    const response = await callChatGPT(fullPrompt, [realityImageBase64]);
    return response.gptResponse;
};


export const respondWithHowToFix = async (				// state 3
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
    console.log(`[state 3: respond with how to fix prompt]: ${prompt}`);
    const response = await callChatGPT(prompt);
    return response.gptResponse;
};


export const freeformResponse = async (				// state 4
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
    console.log(`[state 4: freeform response prompt]: ${prompt}`);
    const response = await callChatGPT(prompt);
    return response.gptResponse;
};


export const handlingUserDisagreements = async (		// state 5
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
    console.log(`[state 5: handling user disagreements prompt]: ${prompt}`);
    const response = await callChatGPT(prompt);
    return response.gptResponse;
};

// @TODO: Test with script only for now, need to replace with video knowledge but with longer items length
export const replayRelevantPartsFromVideos = async (	// state 6
    videoKnowledgeInput: string,
    realityImageBase64: string,
    voiceInputTranscript: string
) => {
    console.log(`[state 6: replay relevant parts from videos prompt]: ${voiceInputTranscript}`);
    const response = await findSentenceFromTranscript(voiceInputTranscript);
    console.log(JSON.stringify(response.gptResponse));
    return JSON.stringify(response.gptResponse);
};




/** Async GPT call */
export async function callChatGPT(prompt: string, imageUrls: string[] = []): Promise<{ "gptResponse": string }> {
    let gptResponse = "";
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
                            gptResponse: {
                                type: "array",
                                items: { type: "number" },
                                description: "Array of sentence IDs that are relevant"
                            }
                        },
                        required: ["gptResponse"]
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