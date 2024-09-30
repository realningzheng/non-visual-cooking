declare interface videoData {
    time: number;
    frame: number;
    action_type: string; // Assuming this is from a predefined set of strings
    action_description: string;
    visual_scene_description: string;
    frame_file_url: string;
    sound_type: string; // Assuming this is from a predefined set of strings
    sound_file_url: string;
    transcript_word: string;
    transcript_sentence: string;
    transcript_sentence_start_time: number;
    transcript_sentence_end_time: number;
    linkedTo: string; 
  }