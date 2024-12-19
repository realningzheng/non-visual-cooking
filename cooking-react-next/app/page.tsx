"use client";
import './globals.css'
import MainLayout from './MainLayout';
import { EventDetectionProvider } from './contexts/EventDetectionContext';
import { MultimodalStateProvider } from './contexts/MultimodalStateContext';
import secret from '../secret.json';

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
const GEMINI_KEY = secret.GEMINI_KEY;

export default function Home() {
	return (
		<EventDetectionProvider url={uri} apiKey={GEMINI_KEY}>
			<MultimodalStateProvider url={uri} apiKey={GEMINI_KEY}>
				<MainLayout />
			</MultimodalStateProvider>
		</EventDetectionProvider>
	);
}
