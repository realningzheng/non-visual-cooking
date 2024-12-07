import transcriptSentenceList from '../data/rwYaDqXFH88_sentence.json';
import OpenAI from 'openai';
import axios from "axios";
import credential from '../../secret.json';


const apiKey = credential.OPENAI_KEY;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });


/** Async GPT call */
export async function callChatGPT(
    systemPrompt: string,
    prompt: string,
    imageUrls: string[] = [],
): Promise<
    { response: string, video_segment_index: number[] } |
    { response: string[] }
> {

    try {
        // delete empty lines in prompt
        prompt = prompt.replace(/\n\s*\n/g, '\n');
        console.log(`[callChatGPT system prompt]: ${systemPrompt}`);
        console.log(`[callChatGPT user prompt]: ${prompt}`);
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
                },
                {
                    type: "function",
                    function: {
                        name: "decide_category_from_user_request",
                        description: "Decide category from user request. In this case, the user should give 1. a command, 2. a list of command categories and their explanations, and examples, 3. a list of command categories and their explanations, and examples, and 4. a list of command categories, their explanations, and examples.",
                        parameters: {
                            type: "object",
                            properties: {
                                response: {
                                    type: "array",
                                    items: { type: "number" },
                                    description: "the category index of the user request"
                                },
                            },
                            required: ["response"]
                        }
                    }
                }
            ],
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
            max_tokens: 1500,
        });

        // Handle both tool_calls and direct content responses
        if (response.choices[0]?.message?.tool_calls?.[0]?.function?.arguments) {
            console.log(`[gpt tool call]: ${response.choices[0].message.tool_calls[0].function.name}`);
            console.log(response.choices[0].message.tool_calls[0].function.arguments);
            return JSON.parse(response.choices[0].message.tool_calls[0].function.arguments);
        } else if (response.choices[0]?.message?.content) {
            console.log(`[gpt direct content response]: ${response.choices[0].message.content}`);
            return { response: [response.choices[0].message.content] };
        } else {
            console.log(`[gpt has no valid response content]`);
            return { response: ["GPT FAILED! Please retry."] };
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error("Error calling GPT-4 API:", error.response?.data);
        } else {
            console.error("Unknown error:", error);
        }
    }

    return { response: ["GPT FAILED! Please retry."] };
}