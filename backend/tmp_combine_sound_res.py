import json

def load_audio_descriptions(file_path):
    descriptions = []
    with open(file_path, 'r') as f:
        for line in f:
            line = line.strip()
            if line.startswith('Time'):
                # Split by first colon (time stamp) and then get the rest
                parts = line.split(':', 1)
                if len(parts) > 1:
                    description = parts[1].strip()
                    # If it contains "Audio caption: ", remove it
                    if "Audio caption: " in description:
                        description = description.split("Audio caption: ")[1]
                    descriptions.append(description)
    return descriptions

def merge_descriptions(video_knowledge_path, audio_desc_path, output_path):
    # Load data
    with open(video_knowledge_path, 'r') as f:
        video_data = json.load(f)
    
    # Load audio descriptions
    audio_descriptions = load_audio_descriptions(audio_desc_path)
    
    # Add audio descriptions to video data
    for i, item in enumerate(video_data):
        if i < len(audio_descriptions):
            item["environment_sound_description"] = audio_descriptions[i]
    
    # Save merged data
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(video_data, f, indent=4, ensure_ascii=False)

# Usage
merge_descriptions(
    '/Users/zhengning/Code/non-visual-cooking/backend/rwYaDqXFH88_video_knowledge.json',
    '/Users/zhengning/Code/non-visual-cooking/backend/data/audio_description.txt',
    '/Users/zhengning/Code/non-visual-cooking/backend/rwYaDqXFH88_video_knowledge_with_audio.json'
)