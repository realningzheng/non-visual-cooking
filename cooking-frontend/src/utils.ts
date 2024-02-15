import axios from 'axios';
import OpenAI from 'openai';

const credential = require('./credential.json');
const apiKey = credential.gptAPIKey;
const openai = new OpenAI({ apiKey: apiKey, dangerouslyAllowBrowser: true });


// export async function findSentenceFromTranscript(prompt: string, sentencesList:): Promise<string> {
  
//   const importantSentencesPrompt = "This is the transcript of video that teaches blind people how to cook. \n" +
// 		`Given the transcript, please tell me which sentences are relevant to ${prompt}, elusive for non-expert audiences to understand and are better with a visual explanation. \n` +
// 		"You are required to pick up sentences evenly from the beginning, middle and end of the transcript. \n" +
// 		"The transcript is given as a list of sentences with ID. Only return the sentence IDs to form the great version. \n" +
// 		"Do not include full sentences in your reply. Only return a list of IDs. Do not return more than 5 sentences. \n" +
// 		"Use the following format: ```[1, 4, 45, 100]```. \n" +
// 		"Make sure the returned format is a list that can be parsed by Json. \n" +
// 		sentencesList.map((s) => `${s["sentenceIndex"]}: ${s["text"]}`).join("\n\n");
//   let gptResponse = "";

//   return gptResponse;
// }

export async function callGpt4V(prompt: string, imageURLList: string[]): Promise<string> {
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
