import json
import shutil
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


print("\n\n--> Initializing...")
print("============================")
VIDEO_ID = "rwYaDqXFH88"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
procedure_annotation = json.load(open(os.path.join(DATA_DIR, f"{VIDEO_ID}_procedure.json")))["annotations"]
transcript_sentence = json.load(open(os.path.join(DATA_DIR, f"{VIDEO_ID}_sentence.json")))
video_path = os.path.join(DATA_DIR, f"{VIDEO_ID}.mp4")
frame_output_dir = os.path.join(DATA_DIR, "key_frames", VIDEO_ID)
audio_output_dir = os.path.join(DATA_DIR, "audio_output", VIDEO_ID)
# Create directories if they don't exist, and clean up existing content
for directory in [frame_output_dir, audio_output_dir]:
    if os.path.exists(directory):
        for file in os.listdir(directory):
            file_path = os.path.join(directory, file)
            if os.path.isfile(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
    else:
        os.makedirs(directory)
# read secret.json
with open(os.path.join(os.path.dirname(__file__), "..", "cooking-react-next", "secret.json"), "r") as f:
    secret = json.load(f)
    OPENAI_API_KEY = secret["OPENAI_KEY"]
gamaClient = Client("sonalkum/GAMA")
print("\t Done.")


print("\n\n--> Preprocessing the video...")
print("============================")
# extract audio track from the video
original_audio_path = os.path.join(audio_output_dir, f"{VIDEO_ID}_original.wav")
os.system(f"ffmpeg -i {video_path} -q:a 0 -map a {original_audio_path} -loglevel quiet")
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
def get_key_frames_and_description(video_path, startTime, endTime):
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


# @TODO: determine the sound type
def determine_sound_type(startTime, endTime, original_audio_path):
    audio_clip_path = os.path.join(audio_output_dir, f"{VIDEO_ID}_clip_{startTime}_{endTime}.wav")
    start_seconds = int(startTime) / 1000
    end_seconds = int(endTime) / 1000
    os.system(f"ffmpeg -i {original_audio_path} -ss {start_seconds:.3f} -to {end_seconds:.3f} -c copy {audio_clip_path} -loglevel quiet")
    
    # audio_file_description, audio_description = gamaClient.predict(
    #     audio_path=handle_file(audio_clip_path),
    #     question="Describe the audio.",
    #     api_name="/predict",
    # )
    # return audio_description
    return "PALCE_HOLDER_SOUND_TYPE"

#####################################
######## Main function ##############
#####################################
if __name__ == "__main__":
    # Fill video knowledge output
    print("\n\n--> Parsing video...")
    print("============================")
    last_end_time = 0
    
    # sample a few sentences for testing
    transcript_sentence = transcript_sentence[10:11]
    total_sentences = len(transcript_sentence)
    for sentenceInfo in tqdm(transcript_sentence, total=total_sentences, desc="Parsing video", unit="sentence"):
        startTime = sentenceInfo["startTime"]
        endTime = sentenceInfo["endTime"]
        sentenceIndex = sentenceInfo["sentenceIndex"]
        text = sentenceInfo["text"]
        _info_piece = info_piece.copy()
        _info_piece["index"] = sentenceIndex
        _info_piece["segment"] = [last_end_time, endTime]
        _info_piece["transcript_sentence"] = text
        _info_piece["procedure_annotation"] = locate_procedure_annotation(
            startTime, endTime
        )
        _info_piece["action_type"] = determine_action_type(startTime, endTime)
        _info_piece["action_description"] = determine_action_description(startTime, endTime)
        _info_piece["key_frame_base64"], _info_piece["visual_scene_description"] = (
            get_key_frames_and_description(video_path, startTime, endTime)
        )
        _info_piece["sound_type"] = determine_sound_type(startTime, endTime, original_audio_path)
        video_knowledge_output.append(_info_piece)

        last_end_time = endTime
        
    with open(os.path.join(DATA_DIR, "parser_res", "video_knowledge.json"), "w") as f:
        json.dump(video_knowledge_output, f, indent=4)

