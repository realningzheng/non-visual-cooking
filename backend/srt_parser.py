import pysrt
import json
import argparse
import os

"""
SRT Parser Script

This script parses SRT subtitle files and converts them to JSON format. It provides two main functionalities:

1. Word-level parsing: Converts each subtitle entry in an SRT file to JSON format with caption index, 
   text content, start time, and end time in milliseconds.

2. Sentence-level parsing: Groups word-level subtitles into sentences (based on punctuation like 
   periods, question marks, and exclamation points) and creates a JSON file with sentence index, 
   text content, start time, and end time.

Usage:
    python srt_parser.py --srt_word_input=<srt_file> --json_sentence_output=<sentence_json_file> --json_word_output=<word_json_file>

If run directly, the script uses default filenames in the same directory as the script.
"""


def parse_srt(srt_word_input, json_word_output):
    # Load the SRT file
    subtitles = pysrt.open(srt_word_input)

    # Create an empty list to store the results
    results = []

    # Iterate over each subtitle in the file
    for caption_idx, subtitle in enumerate(subtitles):
        # Convert the start and end times to milliseconds
        start_time = (
            subtitle.start.hours * 60 * 60 * 1000
            + subtitle.start.minutes * 60 * 1000
            + subtitle.start.seconds * 1000
            + subtitle.start.milliseconds
        )
        end_time = (
            subtitle.end.hours * 60 * 60 * 1000
            + subtitle.end.minutes * 60 * 1000
            + subtitle.end.seconds * 1000
            + subtitle.end.milliseconds
        )

        # Add the text, start time, and end time to the results list
        results.append(
            {
                "caption_idx": caption_idx,
                "text": subtitle.text,
                "startTime": str(start_time),
                "endTime": str(end_time),
            }
        )
    
    # save results to json
    if (json_word_output):
        with open(json_word_output, "w") as f:
            json.dump(results, f, indent=4)

    return results


# This function is used for converting a word-level srt file into a sentence-level json file
def save_sentence_json(srt_word_input, json_sentence_output, json_word_output):
    srt_parsed = parse_srt(srt_word_input, json_word_output)

    sentences_list =[]
    current_sentence_start_time = -1
    current_sentence_end_time = -1
    current_sentence_text = ""
    current_sentence_index = 1

    for item in srt_parsed:
        word = item["text"]
        current_sentence_text += word + " "

        if (current_sentence_start_time == -1):
            current_sentence_start_time = item["startTime"]
        
        if "." in word or "?" in word or "!" in word:
            current_sentence_end_time = item["endTime"]
            sentences_list.append({
                "sentenceIndex": current_sentence_index,
                "text": current_sentence_text,
                "startTime": current_sentence_start_time,
                "endTime": current_sentence_end_time
            })
            current_sentence_start_time = -1
            current_sentence_end_time = -1
            current_sentence_index += 1
            current_sentence_text = ""
    
    # save sentences_list to json
    if(json_sentence_output):
        with open(json_sentence_output, "w") as f:
            json.dump(sentences_list, f, indent=4)

    return False


if __name__ == "__main__":
    VIDEO_ID = "mixdagZ-fwI_core"
    parser = argparse.ArgumentParser()
    parser.add_argument("--srt_word_input", type=str, default="mixdagZ-fwI_core.srt")
    parser.add_argument("--json_sentence_output", type=str, default="mixdagZ-fwI_core_sentence.json")
    parser.add_argument("--json_word_output", type=str, default="mixdagZ-fwI_core_word.json")
    args = parser.parse_args()

    # Get the directory of the current script
    # current_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(os.path.dirname(__file__), "data", "videos_study", VIDEO_ID)

    # Construct full paths using os.path.join
    srt_word_input = os.path.join(data_dir, args.srt_word_input)
    json_sentence_output = os.path.join(data_dir, args.json_sentence_output)
    json_word_output = os.path.join(data_dir, args.json_word_output)

    save_sentence_json(srt_word_input, json_sentence_output, json_word_output)