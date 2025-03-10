import OpenAI from 'openai';
import axios from "axios";
import credential from '../../../secret.json';


const apiKey = credential.OPENAI_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });


/** Async GPT call */
export async function respondAndProvideVideoSegmentIndex(
    systemPrompt: string,
    prompt: string,
    imageUrls: string[] = [],
): Promise<
    { response: string, video_segment_index: number[] }
> {

    try {
        // delete empty lines in prompt
        prompt = prompt.replace(/\n\s*\n/g, '\n');
        // console.log(`[agent response and provide video segment index]: system prompt: ...`);
        // console.log(`[agent response and provide video segment index]: user prompt: ...`);
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
            tools: [
                {
                    type: "function",
                    function: {
                        name: "respond_to_specific_questions_and_provide_video_clip_index",
                        description: "For responding to a specific user request and provide video clip index from the video knowledge",
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
                                    description: "Array of video segment indices that are relevant"
                                }
                            },
                            required: ["response", "video_segment_index"]
                        }
                    }
                }
            ],
            tool_choice: { type: "function", function: { name: "respond_to_specific_questions_and_provide_video_clip_index" } },
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
            max_tokens: 1500,
        });

        // Handle both tool_calls and direct content responses
        if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            // console.log(`[gpt tool call]: ${response.choices[0].message.tool_calls[0].function.name}`);
            // console.log(response.choices[0].message.tool_calls[0].function.arguments);
            return JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
        } else if (response.choices[0]?.message?.content) {
            console.log(`[gpt direct content response]: ${response.choices[0].message.content}`);
            return { response: response.choices[0].message.content, video_segment_index: [] };
        } else {
            console.log(`[gpt has no valid response content]`);
            return { response: "GPT FAILED! Please retry.", video_segment_index: [] };
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Error calling GPT-4 API:", error.response?.data);
        } else {
            console.error("Unknown error:", error);
        }
    }

    return { response: "GPT FAILED! Please retry.", video_segment_index: [] };
}


export async function retrievePreviousInteraction(
    systemPrompt: string,
    prompt: string,
): Promise<
    { response: number }
> {

    try {
        // delete empty lines in prompt
        prompt = prompt.replace(/\n\s*\n/g, '\n');
        console.log(`[retrieve interaction system prompt]: ${systemPrompt}`);
        console.log(`[retrieve interaction user prompt]: ${prompt}`);
        // Construct content array with text prompt and any provided images
        const content: Array<{ type: string } & Record<string, any>> = [
            { type: "text", text: prompt }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "retrieve_previous_interaction",
                        description: "Retrieve the one, and only one, of the most relevant part from previous interactions based on user request",
                        parameters: {
                            type: "object",
                            properties: {
                                response: {
                                    type: "number",
                                    description: "the index of the most relevant part from previous interactions based on user request"
                                },
                            },
                            required: ["response"]
                        }
                    }
                }
            ],
            tool_choice: { type: "function", function: { name: "retrieve_previous_interaction" } },
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
            max_tokens: 1500,
        });

        // Handle both tool_calls and direct content responses
        if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            console.log(`[gpt tool call]: ${response.choices[0].message.tool_calls[0].function.name}`);
            console.log(response.choices[0].message.tool_calls[0].function.arguments);
            return JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
        } else if (response.choices[0]?.message?.content) {
            console.log(`[gpt direct content response]: ${response.choices[0].message.content}`);
            return { response: Number(response.choices[0].message.content) };
        } else {
            console.log(`[gpt has no valid response content]`);
            return { response: -1 };
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Error calling GPT-4 API:", error.response?.data);
        } else {
            console.error("Unknown error:", error);
        }
    }

    return { response: -1 };
}


export async function determinePlaySegmentedVideo(
    systemPrompt: string,
    prompt: string,
): Promise<{ response: number }> {
  
    try {
        // delete empty lines in prompt
        prompt = prompt.replace(/\n\s*\n/g, '\n');
        console.log(`[retrieve interaction system prompt]: ${systemPrompt}`);
        console.log(`[retrieve interaction user prompt]: ${prompt}`);
        // Construct content array with text prompt and any provided images
        const content: Array<{ type: string } & Record<string, any>> = [
            { type: "text", text: prompt }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "video_play_pause_replay_determine",
                        description: "determine if the user request is about playing the video, pause the video, or replay from the beginning of the video",
                        parameters: {
                            type: "object",
                            properties: {
                                response: {
                                    type: "number",
                                    description: "0 if the user request is about playing the video, 1 if they want to pause the video, 2 if they want to replay from the beginning of the video"
                                },
                            },
                            required: ["response"]
                        }
                    }
                }
            ],
            tool_choice: { type: "function", function: { name: "video_play_pause_replay_determine" } },
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
            max_tokens: 1500,
        });

        // Handle both tool_calls and direct content responses
        if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            console.log(`[gpt tool call]: ${response.choices[0].message.tool_calls[0].function.name}`);
            console.log(response.choices[0].message.tool_calls[0].function.arguments);
            return JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
        } else if (response.choices[0]?.message?.content) {
            console.log(`[gpt direct content response]: ${response.choices[0].message.content}`);
            return { response: Number(response.choices[0].message.content) };
        } else {
            console.log(`[gpt has no valid response content]`);
            return { response: -1 };
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Error calling GPT-4 API:", error.response?.data);
        } else {
            console.error("Unknown error:", error);
        }
    }

    return { response: -1 };
}


export async function decideCategoryFromUserRequest(
    systemPrompt: string,
    prompt: string,
): Promise<{ response: number }> {
    try {
        prompt = prompt.replace(/\n\s*\n/g, '\n');
        console.log(`[decide category from user request system prompt]: ${systemPrompt}`);
        console.log(`[decide category from user request user prompt]: ${prompt}`);

        const content: Array<{ type: string } & Record<string, any>> = [
            { type: "text", text: prompt }
        ];

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            tools: [
                {
                    type: "function",
                    function: {
                        name: "decide_category_from_user_request",
                        description: "Decide category from user request. In this case, the user should give 1. a command, 2. a list of command categories and their explanations, and examples, 3. a list of command categories and their explanations, and examples, and 4. a list of command categories, their explanations, and examples.",
                        parameters: {
                            type: "object",
                            properties: {
                                response: {
                                    type: "number",
                                    description: "the category index of the user request (a single number)"
                                },
                            },
                            required: ["response"]
                        }
                    }
                }
            ],
            tool_choice: { type: "function", function: { name: "decide_category_from_user_request" } },
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

        if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            console.log(`[gpt tool call]: ${response.choices[0].message.tool_calls[0].function.name}`);
            console.log(response.choices[0].message.tool_calls[0].function.arguments);
            const parsed = JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
            // Handle case where response might be an array
            return { 
                response: Array.isArray(parsed.response) ? parsed.response[0] : parsed.response 
            };
        }

        return { response: -1 };
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Error calling GPT-4 API:", error.response?.data);
        } else {
            console.error("Unknown error:", error);
        }
        return { response: -1 };
    }
}


export const extractProcedureSequence = (videoKnowledge: string): string[] => {
    try {
        if (videoKnowledge.length === 0) {
            return [];
        }
        const knowledge = JSON.parse(videoKnowledge);
        const procedures = new Set<string>();

        // Extract unique non-empty procedures
        knowledge.forEach((item: any) => {
            if (item.procedure_description && item.procedure_description.trim().length > 0) {
                procedures.add(item.procedure_description.trim());
            }
        });

        // Convert to array and filter out duplicates
        return Array.from(procedures).filter(Boolean);
    } catch (error) {
        console.error('Error parsing video knowledge:', error);
        return [];
    }
};