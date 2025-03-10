"""
Video Knowledge Extraction Tool
This script processes cooking videos to extract structured knowledge about their content.
It performs scene detection, audio analysis, and image analysis to create a detailed
knowledge base of the video's content.

Features:
- Automatic scene detection to extract key frames
- Audio extraction and environment sound analysis
- Frame analysis using computer vision and GPT-4o
- Transcript processing and segmentation
- Comprehensive output in structured JSON format

Dependencies:
- OpenAI API for image analysis
- GAMA model via Gradio for audio analysis
- FFmpeg for audio extraction
- SceneDetect for video scene detection
- OpenCV for image processing

Usage:
Place the video file and its annotation files in the appropriate directory
Run the script to process the video
The resulting knowledge base will be saved as a JSON file

Output format includes:
- Video transcript segments
- Time segments
- Video clip descriptions
- Food and kitchenware descriptions
- Environmental sound descriptions
"""

import json
import shutil
import cv2
import base64
import os
from openai import OpenAI
from gradio_client import Client, handle_file
from tqdm import tqdm
from scenedetect import VideoManager, SceneManager
from scenedetect.detectors import ContentDetector
from scenedetect.scene_manager import save_images


######## Global variables ########
# Result format
video_knowledge_output = []
info_piece = {
    "index": int,
    "segment": [int, int],
    "video_transcript": str,
    "procedure_description": str,
    # "action_type": str,
    # "action_description": str,
    # "object_list": list[str],
    # "visual_scene_base64": list[str],
    # "visual_scene_path": list[str],
    "step_description": str,      # describe the step being performed in the video clip
    "food_and_kitchenware_description": str, # describe the food and kitchenware objects in the video clip
    "environment_sound_description": str, # describe the environment sound
}

print("--> Initializing...")
VIDEO_ID = "mixdagZ-fwI_core"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "videos_study", VIDEO_ID)
procedure_annotation = json.load(
    open(os.path.join(DATA_DIR, f"{VIDEO_ID}_procedure.json"))
)["annotations"]
transcript_sentence = json.load(
    open(os.path.join(DATA_DIR, f"{VIDEO_ID}_sentence.json"))
)
video_path = os.path.join(DATA_DIR, f"{VIDEO_ID}.mp4")
frame_output_dir = os.path.join(DATA_DIR, "key_frames")
audio_output_dir = os.path.join(DATA_DIR, "audio_output")
res_output_dir = os.path.join(DATA_DIR, "parser_res")

# Create directories if they don't exist, and clean up existing content
for directory in [frame_output_dir, audio_output_dir, res_output_dir]:
    if os.path.exists(directory):
        for file in os.listdir(directory):
            file_path = os.path.join(directory, file)
            if os.path.isfile(file_path):
                os.unlink(file_path)
            elif os.path.isdir(file_path):
                shutil.rmtree(file_path)
    else:
        os.makedirs(directory)

# Initialize video manager
video_manager = VideoManager([video_path])
scene_manager = SceneManager()
scene_manager.add_detector(ContentDetector(threshold=10))

try:
    # Start the video manager and run scene detection
    video_manager.start()
    scene_manager.detect_scenes(frame_source=video_manager)

    # Get the list of detected scenes
    scene_list = scene_manager.get_scene_list()
    print(f"Detected {len(scene_list)} scenes.")

    # Save images for each scene with timestamps in filename
    for i, scene in enumerate(scene_list):
        start_time = int(scene[0].get_seconds() * 1000)  # Convert to milliseconds
        end_time = int(scene[1].get_seconds() * 1000)
        filename = f"{VIDEO_ID}_scene_{start_time}_{end_time}"
        save_images(
            scene_list=[scene],
            video=video_manager,
            num_images=1,
            output_dir=frame_output_dir,
            image_name_template=filename,
        )
finally:
    # Release the video manager resources
    video_manager.release()

# read secret.json
with open(
    os.path.join(os.path.dirname(__file__), "..", "cooking-react-next", "secret.json"),
    "r",
) as f:
    secret = json.load(f)
    OPENAI_API_KEY = secret["OPENAI_KEY"]
    HF_TOKEN = secret["HF_TOKEN"]


# gamaClient = Client("sonalkum/GAMA")
gamaClient = Client("sonalkum/GAMA-IT")
# gamaClient = Client.duplicate("sonalkum/GAMA", hardware='a10g-small', hf_token=HF_TOKEN)
print("Done.")


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
        model="gpt-4o-mini", messages=messages, max_tokens=100
    )
    # Return the response
    return response.choices[0].message.content


# Given the start and end time of a video, locate the corresponding procedure annotation
def locate_procedure_annotation(startTime, endTime):
    for annotation in procedure_annotation:
        if (
            (
                annotation["segment"][0] <= float(startTime) / 1000
                and annotation["segment"][1] >= float(endTime) / 1000
            )
            or (
                annotation["segment"][0] >= float(startTime) / 1000
                and annotation["segment"][0] <= float(endTime) / 1000
            )
            or (
                annotation["segment"][1] >= float(endTime) / 1000
                and annotation["segment"][1] <= float(startTime) / 1000
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


# get video clip description
def get_step_description(startTime, endTime):
    frames = []
    for file in os.listdir(frame_output_dir):
        if file.startswith(f"{VIDEO_ID}_scene_") and len(file.split("_")) >= 4:
            file_start = int(file.split("_")[-2])
            file_end = int(file.split("_")[-1].split(".")[0])
            if (
                (file_start >= int(startTime) and file_end <= int(endTime))
                or (file_end >= int(startTime) and file_start <= int(startTime))
                or (file_end >= int(endTime) and file_start <= int(endTime))
            ):
                with open(os.path.join(frame_output_dir, file), "rb") as image_file:
                    frames.append(base64.b64encode(image_file.read()).decode("utf-8"))
    prompt = "Analyze these consecutive screenshots from a cooking video and identify the specific cooking step being performed. \
            Focus on the primary cooking action or technique being demonstrated \
            Describe the cooking step with precise, action-oriented natural language. \
            Consider all screenshots as representing a single continuous cooking step. \
            e.g. 'The chef is sautéing diced vegetables in olive oil over medium heat while stirring continuously to ensure even cooking.' \
            Provide your description directly without phrases like 'The video shows...' or 'In this clip...'"
    step_desp = analyze_images_with_gpt4(frames, prompt)
    return step_desp


# get food and kitchenware description
def get_food_and_kitchenware_description(startTime, endTime):
    frames = []
    for file in os.listdir(frame_output_dir):
        if file.startswith(f"{VIDEO_ID}_scene_") and len(file.split("_")) >= 4:
            file_start = int(file.split("_")[-2])
            file_end = int(file.split("_")[-1].split(".")[0])
            if (
                (file_start >= int(startTime) and file_end <= int(endTime))
                or (file_end >= int(startTime) and file_start <= int(startTime))
                or (file_end >= int(endTime) and file_start <= int(endTime))
            ):
                with open(os.path.join(frame_output_dir, file), "rb") as image_file:
                    frames.append(base64.b64encode(image_file.read()).decode("utf-8"))
    prompt = "Analyze these consecutive screenshots from a cooking video and provide a description on \
            the appearance, relative position and relationship of the following objects:  \
            1. Ingredients: focusing on their state (raw, chopped, cooked, etc.), appearance, and approximate quantities. \
            2. Kitchenware: Identify all tools, utensils, cookware, and appliances, describing how they're currently being used. \
            e.g., 'diced onions in a metal bowl next to a chef's knife'\
            Describe the food and kitchenware objects in precise natural language. \
            \
            Consider all screenshots as a continuous scene rather than explaining each screenshot separately. \
            Start directly with your description without any introductory phrases like 'The video shows...' or 'I can see...'"
    food_and_kitchenware_desp = analyze_images_with_gpt4(frames, prompt)
    return food_and_kitchenware_desp


# get visual scene base64
def get_visual_scene_base64(startTime, endTime):
    frames = []
    for file in os.listdir(frame_output_dir):
        if file.startswith(f"{VIDEO_ID}_scene_") and len(file.split("_")) >= 4:
            file_start = int(file.split("_")[-2])
            file_end = int(file.split("_")[-1].split(".")[0])
            if (
                (file_start >= int(startTime) and file_end <= int(endTime))
                or (file_end >= int(startTime) and file_start <= int(startTime))
                or (file_end >= int(endTime) and file_start <= int(endTime))
            ):
                with open(os.path.join(frame_output_dir, file), "rb") as image_file:
                    frames.append(base64.b64encode(image_file.read()).decode("utf-8"))
    return frames


# get visual scene path
def get_visual_scene_path(startTime, endTime):
    paths = []
    for file in os.listdir(frame_output_dir):
        if file.startswith(f"{VIDEO_ID}_scene_") and len(file.split("_")) >= 4:
            file_start = int(file.split("_")[-2])
            file_end = int(file.split("_")[-1].split(".")[0])
            if (
                (file_start >= int(startTime) and file_end <= int(endTime))
                or (file_end >= int(startTime) and file_start <= int(startTime))
                or (file_end >= int(endTime) and file_start <= int(endTime))
            ):
                paths.append(os.path.join(frame_output_dir, file))
    return paths


# get object list
def get_object_list(startTime, endTime):
    return ["OBJ1", "OBJ2", "OBJ3"]


# @TODO: determine the sound type
def get_environment_sound_description(startTime, endTime, original_audio_path):
    transcript_start_seconds = float(startTime) / 1000
    transcript_end_seconds = float(endTime) / 1000
    # if length is less than 10 seconds, increase the start and end time to 10 seconds in total
    # Make clip exactly 10 seconds by extending equally on both sides
    if transcript_end_seconds - transcript_start_seconds < 10:
        time_to_add = (10 - (transcript_end_seconds - transcript_start_seconds)) / 2
        audio_clip_start_seconds = transcript_start_seconds - time_to_add
        audio_clip_end_seconds = transcript_end_seconds + time_to_add
    else:
        audio_clip_start_seconds = transcript_start_seconds
        audio_clip_end_seconds = transcript_end_seconds
    audio_clip_path = os.path.join(
        audio_output_dir,
        f"{VIDEO_ID}_clip_{transcript_start_seconds}_{transcript_end_seconds}.wav",
    )
    os.system(
        f"ffmpeg -i {original_audio_path} -ss {max(0, audio_clip_start_seconds):.3f} -to {audio_clip_end_seconds:.3f} -c copy {audio_clip_path} -loglevel quiet"
    )

    _, audio_description = gamaClient.predict(
        audio_path=handle_file(audio_clip_path),
        question="Describe the audio precisely.\
            You should focus on the non-speech part of the audio. \
            Go straight to the description without any introductory words such as: \
            'Audio caption:...', 'Audio description:...', etc.",
        api_name="/predict",
    )
    # save audio_description to a txt file
    # with open(os.path.join(audio_output_dir, "audio_description.txt"), "a") as f:
    #     f.write(
    #         f"Time {transcript_start_seconds:.1f}-{transcript_end_seconds:.1f}s: {audio_description}\n"
    #     )
    return audio_description


#####################################
######## Main function ##############
#####################################
if __name__ == "__main__":
    REQUIRED_KEY = [
        "index",
        "segment",
        "video_transcript",
        "procedure_description",
        "step_description",              # describe the step being performed in the video clip
        "food_and_kitchenware_description",    # describe the food and kitchenware objects in the video clip
        "environment_sound_description"        # describe the environment sound
    ]
    
    print("\n--> Getting audio track...")
    # extract audio track from the video
    original_audio_path = os.path.join(audio_output_dir, f"{VIDEO_ID}_original.wav")
    os.system(
        f"ffmpeg -i {video_path} -q:a 0 -map a {original_audio_path} -loglevel quiet"
    )
    print("Done.")

    # Fill video knowledge output
    print("\n--> Parsing video...")
    last_end_time = 0

    # sample a few sentences for testing
    # transcript_sentence = transcript_sentence[:3]
    total_sentences = len(transcript_sentence)
    for sentenceInfo in tqdm(
        transcript_sentence,
        total=total_sentences,
        desc="Parsing video",
        unit="sentence",
    ):
        startTime = sentenceInfo["startTime"]
        endTime = sentenceInfo["endTime"]
        sentenceIndex = sentenceInfo["sentenceIndex"]
        text = sentenceInfo["text"]
        _info_piece = {}
        if "index" in REQUIRED_KEY:
            _info_piece["index"] = sentenceIndex
        if "segment" in REQUIRED_KEY:
            _info_piece["segment"] = [last_end_time, endTime]
        if "video_transcript" in REQUIRED_KEY:
            _info_piece["video_transcript"] = text
        if "procedure_description" in REQUIRED_KEY:
            _info_piece["procedure_description"] = locate_procedure_annotation(
                startTime, endTime
            )
        if "step_description" in REQUIRED_KEY:
            _info_piece["step_description"] = get_step_description(
                startTime, endTime
            )
        if "food_and_kitchenware_description" in REQUIRED_KEY:
            _info_piece["food_and_kitchenware_description"] = (
                get_food_and_kitchenware_description(
                    startTime, endTime
                )
            )
        if "environment_sound_description" in REQUIRED_KEY:
            # _info_piece["environment_sound_description"] = (
            #     get_environment_sound_description(
            #         startTime, endTime, original_audio_path
            #     )
            # )
            _info_piece["environment_sound_description"] = ""
        # if "object_list" in REQUIRED_KEY:
        #     _info_piece["object_list"] = get_object_list(startTime, endTime)
        # if "visual_scene_base64" in REQUIRED_KEY:
        #     _info_piece["visual_scene_base64"] = get_visual_scene_base64(
        #         startTime, endTime
        #     )
        # if "visual_scene_path" in REQUIRED_KEY:
        #     _info_piece["visual_scene_path"] = get_visual_scene_path(startTime, endTime)
        video_knowledge_output.append(_info_piece)

        last_end_time = endTime

    with open(
        os.path.join(res_output_dir, f"{VIDEO_ID}_video_knowledge.json"), "w"
    ) as f:
        json.dump(video_knowledge_output, f, indent=4)
