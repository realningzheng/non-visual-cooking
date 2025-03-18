import os
from pathlib import Path
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_KEY"))
# get the path for the current file
current_file_path = Path(__file__).parent
# get the path for the speech file
speech_file_path = current_file_path / "analyzing_in_progress4.mp3"

response = client.audio.speech.create(
    model="tts-1",
    voice="alloy",
    input="Go ahead!",
    speed=1
)
response.stream_to_file(speech_file_path)