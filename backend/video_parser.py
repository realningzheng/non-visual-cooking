import json
import cv2
import base64
import os
from openai import OpenAI

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

# Assume we have the procedure segmented
procedure_annotation = json.load(
    open(
        "/Users/zhengning/Code/non-visual-cooking/backend/data/making_burger_ground_truth_procedure.json"
    )
)["annotations"]
transcript_sentence = json.load(
    open(
        "/Users/zhengning/Code/non-visual-cooking/backend/data/making_burger_sentence.json"
    )
)
VIDEO_PATH = "/Users/zhengning/Code/non-visual-cooking/backend/data/making_burger.mp4"
frame_output_dir = "/Users/zhengning/Code/non-visual-cooking/backend/data/key_frames"


# Make GPT call
def analyze_images_with_gpt4(image_base64_list, prompt):
    client = OpenAI(api_key='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')
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
    return "PALCE_HOLDER_SOUND_TYPE"


# Fill video knowledge output
last_end_time = 0
for sentenceInfo in transcript_sentence:
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
        extract_key_frames_and_description(VIDEO_PATH, startTime, endTime)
    )
    _info_piece["sound_type"] = determine_sound_type(startTime, endTime)
    video_knowledge_output.append(_info_piece)

    last_end_time = endTime

print("end")
