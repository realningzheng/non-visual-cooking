import os
from gradio_client import Client, handle_file

gamaClient = Client("sonalkum/GAMA")

# get the path of the current file
PATH_CURRENT = os.path.abspath(__file__)
PATH_AUDIO_CLIPS_DIR = os.path.join(os.path.dirname(PATH_CURRENT), "data/test_audio_clips")

# if the directory does not exist, create it, if it does, delete all files in it
if not os.path.exists(PATH_AUDIO_CLIPS_DIR):
    os.makedirs(PATH_AUDIO_CLIPS_DIR)
else:
    for file in os.listdir(PATH_AUDIO_CLIPS_DIR):
        os.remove(os.path.join(PATH_AUDIO_CLIPS_DIR, file))

# the path of the original audio file with vocal
PATH_ORG_AUDIO = "/Users/zhengning/Code/non-visual-cooking/backend/data/audio_output/rwYaDqXFH88/rwYaDqXFH88_original.wav"

def get_environment_sound_description(startTime, endTime):
    audio_clip_path = os.path.join(
        PATH_AUDIO_CLIPS_DIR, f"audio_clip_{startTime}_{endTime}.wav"
    )
    start_seconds = float(startTime)
    end_seconds = float(endTime)
    os.system(
        f"ffmpeg -i {PATH_ORG_AUDIO} -ss {start_seconds:.3f} -to {end_seconds:.3f} -c copy {audio_clip_path} -loglevel quiet"
    )
    
    audio_file_description, audio_description = gamaClient.predict(
        audio_path=handle_file(audio_clip_path),
        question="Describe the audio.",
        api_name="/predict",
    )
    return audio_description


print(get_environment_sound_description(280, 290))
