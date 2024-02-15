import pysrt
import json
import argparse


def parse_srt(srt_file_path, srt_json_path):
    # Load the SRT file
    subtitles = pysrt.open(srt_file_path)

    # Create an empty list to store the results
    results = []

    # Iterate over each subtitle in the file
    # TODO: convert to real sentences, by detecting ./?/!
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
    if (srt_json_path):
        with open(srt_json_path, "w") as f:
            json.dump(results, f, indent=4)

    return results


# This function is used for converting a word-level srt file into a sentence-level json file
def get_sentence_list(srt_file_path, sentence_json_path, word_json_path):
    srt_parsed = parse_srt(srt_file_path, word_json_path)

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
    if(sentence_json_path):
        with open(sentence_json_path, "w") as f:
            json.dump(sentences_list, f, indent=4)

    return sentences_list


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--srt_file_path", type=str, default="/Users/zhengning/Code/non-visual-cooking/backend/data/cooking_steak_word_level.srt")
    parser.add_argument("--sentence_json_path", type=str, default="/Users/zhengning/Code/non-visual-cooking/backend/data/cooking_steak_sentence.json")
    parser.add_argument("--word_json_path", type=str, default="/Users/zhengning/Code/non-visual-cooking/backend/data/cooking_steak_word.json")
    args = parser.parse_args()

    get_sentence_list(args.srt_file_path, args.sentence_json_path, args.word_json_path)