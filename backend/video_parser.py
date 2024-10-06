import json
import cv2
import base64
import os
from openai import OpenAI
from gradio_client import Client, handle_file
from tqdm import tqdm


######## Global variables ########
# Result format
video_knowledge_output = []
info_piece = {
    "index": int,
    "segment": [int, int],
    "transcript_sentence": str,
    "procedure_annotation": str,
    "action_type": str,
    "action_description": str,
    "key_frame_base64": [str, str, str],
    "visual_scene_description": str,
    "sound_type": str,
}


print("--> Initializing...")
VIDEO_ID = "rwYaDqXFH88"
DATA_DIR = "/Users/zhengning/Code/non-visual-cooking/backend/data"
procedure_annotation = json.load(open(os.path.join(DATA_DIR, f"{VIDEO_ID}_procedure.json")))["annotations"]
transcript_sentence = json.load(open(os.path.join(DATA_DIR, f"{VIDEO_ID}_sentence.json")))
video_path = os.path.join(DATA_DIR, f"{VIDEO_ID}.mp4")
frame_output_dir = os.path.join(DATA_DIR, "key_frames", VIDEO_ID)
audio_output_dir = os.path.join(DATA_DIR, "audio_output", VIDEO_ID)
# Create directories if they don't exist
os.makedirs(frame_output_dir, exist_ok=True)
os.makedirs(audio_output_dir, exist_ok=True)
# read secret.json
with open("/Users/zhengning/Code/non-visual-cooking/cooking-react-next/secret.json", "r") as f:
    secret = json.load(f)
    OPENAI_API_KEY = secret["OPENAI_KEY"]
gamaClient = Client("sonalkum/GAMA")
print("\t Done.")


print("--> Preprocessing the video...")
# extract audio track from the video
audio_path = os.path.join(audio_output_dir, f"{VIDEO_ID}_original.wav")
os.system(f"ffmpeg -i {video_path} -q:a 0 -map a {audio_path}")
print("\t Done.")


#####################################
######## Bootstrap functions ########
#####################################
# Make GPT call
def analyze_images_with_gpt4(image_base64_list, prompt):
    client = OpenAI(api_key=OPENAI_API_KEY)
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": prompt},
            ]
            + [
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{image_base64}"},
                }
                for image_base64 in image_base64_list
            ],
        }
    ]
    response = client.chat.completions.create(
        model="gpt-4o", messages=messages, max_tokens=500
    )
    # Return the response
    return response.choices[0].message.content


# Given the start and end time of a video, locate the corresponding procedure annotation
def locate_procedure_annotation(startTime, endTime):
    for annotation in procedure_annotation:
        if (
            (
                annotation["segment"][0] <= int(startTime)
                and annotation["segment"][1] >= int(endTime)
            )
            or (
                annotation["segment"][0] >= int(startTime)
                and annotation["segment"][0] <= int(endTime)
            )
            or (
                annotation["segment"][1] >= int(endTime)
                and annotation["segment"][1] <= int(startTime)
            )
        ):
            return annotation["sentence"]
    return ""


# determine the action type
def determine_action_type(startTime, endTime):
    return "PALCE_HOLDER_ACTION_TYPE"


# determine the action description
def determine_action_description(startTime, endTime):
    return "PALCE_HOLDER_ACTION_DESCRIPTION"


# extract the key frame from the video
def extract_key_frames_and_description(video_path, startTime, endTime):
    cap = cv2.VideoCapture(video_path)
    duration = int(endTime) - int(startTime)
    interval = duration / 2
    frames = []
    for i in range(3):
        frame_time = int(startTime) + i * interval
        cap.set(cv2.CAP_PROP_POS_MSEC, frame_time)
        ret, frame = cap.read()
        if ret:
            _, buffer = cv2.imencode(".png", frame)
            frame_base64 = base64.b64encode(buffer).decode("utf-8")
            filename = f"frame_{startTime}_{endTime}_{i}.png"
            filepath = os.path.join(frame_output_dir, filename)
            cv2.imwrite(filepath, frame)
            frames.append(frame_base64)
    cap.release()

    prompt = "These are three consecutive screenshots from a video, respond with a description to the current scene precisely."
    scene_desp = analyze_images_with_gpt4(frames, prompt)

    return frames, scene_desp


# determine the sound type
def determine_sound_type(startTime, endTime):
    audio_description = gamaClient.predict(
        audio_path=handle_file(video_path),
        question="Describe the audio.",
        api_name="/predict",
    )
    return audio_description


#####################################
######## Main function ##############
#####################################
if __name__ == "__main__":
    # Fill video knowledge output
    print("\t Parsing video...")
    last_end_time = 0
    total_sentences = len(transcript_sentence)
    for sentenceInfo in tqdm(transcript_sentence, total=total_sentences, desc="Parsing video", unit="sentence"):
        startTime = sentenceInfo["startTime"]
        endTime = sentenceInfo["endTime"]

        text = sentenceInfo["text"]
        _info_piece = info_piece.copy()
        _info_piece["segment"] = [last_end_time, endTime]
        _info_piece["transcript_sentence"] = text
        _info_piece["procedure_annotation"] = locate_procedure_annotation(
            startTime, endTime
        )
        _info_piece["action_type"] = determine_action_type(startTime, endTime)
        _info_piece["action_description"] = determine_action_description(startTime, endTime)
        _info_piece["key_frame_base64"], _info_piece["visual_scene_description"] = (
            extract_key_frames_and_description(video_path, startTime, endTime)
        )
        _info_piece["sound_type"] = determine_sound_type(startTime, endTime)
        video_knowledge_output.append(_info_piece)

        last_end_time = endTime
        
    with open("/Users/zhengning/Code/non-visual-cooking/backend/data/parser_output/video_knowledge.json", "w") as f:
        json.dump(video_knowledge_output, f)

