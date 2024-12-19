"use client";
import './globals.css'
import { LiveAPIProvider } from './contexts/LiveAPIContext';
import MainLayout from './MainLayout';
import secret from '../secret.json';

const host = "generativelanguage.googleapis.com";
const uri = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`;
const GEMINI_KEY = secret.GEMINI_KEY;


export default function Home() {
	return (
		<LiveAPIProvider url={uri} apiKey={GEMINI_KEY}>
			<MainLayout />
		</LiveAPIProvider>
	);
}
