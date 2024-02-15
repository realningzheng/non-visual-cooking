import axios from 'axios';
import OpenAI from 'openai';

const credential = require('./credential.json');
const apiKey = credential.gptAPIKey;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });

export async function callGpt4(prompt: string, imageURLList: string[]): Promise<string> {
  let gptResponse = "";
  try {
    console.log(prompt);
    console.log(imageURLList);
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `${prompt}` },
            {
              type: "image_url",
              image_url: {
                "url": imageURLList[0],
              },
            },
            {
              type: "image_url",
              image_url: {
                "url": imageURLList[1],
              },
            }
          ],
        },
      ],
      max_tokens: 1500,
    });
    console.log(response);
    if (response.choices[0]['message']['content']) {
      gptResponse = response.choices[0]['message']['content'];
    }

    console.log(gptResponse);

  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error("Error calling GPT-4 API:", error.response?.data);
    } else {
      console.error("Unknown error:", error);
    }
  }

  return gptResponse;
}
