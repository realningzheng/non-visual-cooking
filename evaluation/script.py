import json, os
import openai
from dotenv import load_dotenv

load_dotenv()
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Load video annotations
with open("videoAnnotations/videoAnnotations.json", "r") as file:
    video_annotations = json.load(file)

output_data = {}
for annotations in video_annotations:
    PROMPT_TEMPLATE = """
    Suppose you are a visually impaired user who is cooking. An agent can analyze your cooking condition in real-time. During cooking, you can ask six types of questions to the agent:

    <User-Initiated Questions>
    {
        "step_related": `User asks about step related questions
            - Questions about current, previous, or future steps in the cooking process
            - Examples:
                * "What's the next step I should do?"
                * "What steps did I miss?"
                * "What step am I on right now?"
                * "What should I do next?" 
                * "Was I supposed to preheat the oven?"`,

        "problem_fixing": `User perceives a problem and asks how to fix something
            - Requests for correction or problem-solving
            - Examples:
                * "The sauce is too thick, how do I fix it?"
                * "I added too much salt, what should I do?"
                * "The dough isn't rising, how can I fix this?"
                * "I burned the steak, can this be saved?"`,

        "repeat_interaction": `User asks for repeating a previous interaction
            - User seeks to recall the agent's response from the previous interaction.
            - Examples:
                * "Can you say that again?"
                * "I didn't catch you."
                * "What did you say about XXXX?"
                * "Please repeat the last instruction"
                * "How did you say about the ingredients for making the sauce?"`,

        "general_question": `User asks for general questions
            - General cooking queries based on the video knowledge except for a specific steps or food states
            - Examples:
                * "What other ingredients do we need?"
                * "How many steps are still left?"`,

        "visual_confirmation": `User asks about confirmations of visual elements in the cooking scene. 
            - Seeking visual description and verification of food states
            - Examples:
                * "Can you explain the current scene for me?"
                * "What is the current state of the food?"
                * "What are things around me now?"
                * "I'm a chopping the onion in a right way?"
                * "Is this the right ingredient?"
                * "How does my steak look like now?"`,

        "previous_step_recall": `User seeks to retrieve previous steps or interactions
            - Asking for recall of previous steps or actions
            - Examples:
                * "What's my last step?"
                * "What did I do before this?"
                * "What did I add last?"
                * "What are my last three steps?"`,
    }

    Your cooking process is summarized by <User Stream Annotation> (attached below). 

    <User Stream Annotation>""" + f"{annotations}" + """
    \nPlease generate three queries for each of the six user-initiated events in the following format:
    video_id: {
        "event_type": text,
        "query": text,
        "segment": [start, end]
    }
    Important: please ensure that in each query, the cooking process that timestamp matches is related to the query. Also, please ensure that the query is resonable (i.e., it is a question that a visually impaired user would likely to ask during cooking). 
    Finally, only return the json response. Example output:
    {
        "1": [
            {
                "event_type": "step_related",
                "query": "What's the next step I should do after adding the green pepper and stirring it?",
                "segment": [
                    868,
                    882
                ]
            },
            ...
        ]
    }
    """

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "You are an AI that generates structured queries for cooking assistance."},
            {"role": "user", "content": PROMPT_TEMPLATE}
        ],
        temperature=0.7
    )

    try:
        queries = json.loads(response.choices[0].message.content)
        
        if isinstance(queries, list):
            for query in queries:
                if isinstance(query, dict):
                    output_data.update(query)
                    print("Generated queries:")
                else:
                    print(f"Unexpected query format: {query}")
        elif isinstance(queries, dict):
            output_data.update(queries)
        else:
            print(f"Unexpected response format: {queries}")

    except json.JSONDecodeError as e:
        print(f"JSON decoding failed: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")

# Save the output to a JSON file
output_file = "generatedQueries.json"
with open(output_file, "w") as file:
    json.dump(output_data, file, indent=4)

print(f"Generated queries saved to {output_file}")