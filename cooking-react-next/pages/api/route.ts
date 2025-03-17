import type { NextApiRequest, NextApiResponse } from "next";
import { OpenAI } from "openai";
import fs from "fs";
import path from "path";
import secret from "../../secret.json";

const openai = new OpenAI({
    apiKey: secret.OPENAI_KEY
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow GET requests (for streaming audio)
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method Not Allowed" });
    }

    try {
        const { input, speed } = req.query;

        if (!input || typeof input !== 'string') {
            return res.status(400).json({ error: "Text input is required" });
        }

        const ttsSpeed = speed ? parseFloat(speed as string) : 1.0;

        // Set appropriate headers for streaming audio
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        const response = await openai.audio.speech.create({
            model: "tts-1",
            voice: "alloy",
            input: input,
            response_format: 'mp3',
            speed: ttsSpeed
        });

        // Stream the response directly to the client
        const readableStream = response.body;
        readableStream.pipe(res);

        // Handle stream events
        readableStream.on('error', (error) => {
            console.error("Error in TTS stream:", error);
            // The stream might already be piped to the response, so we can't reliably send an error response here
        });
    } catch (error) {
        console.error("Error generating speech:", error);
        // Only send error response if headers haven't been sent yet
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to generate speech" });
        } else {
            // Force-close the connection if we've already started streaming
            res.end();
        }
    }
}