// Make this file a module by adding an empty export statement
export {};

const {
	comparingVideoRealityAlignment,
	explainCurrentState,
	explainCurrentStep,
	respondWithHowToFix,
	freeformResponse,
	handlingUserDisagreements,
	replayRelevantPartsFromVideos,
	answerPreviousUserSteps,
	callChatGPT
} = require('./../stateFunctions');
const fs = require("fs");
const inputPath = "./test_input/test-input.json";
const outputPath = "./test_input/test-output.json";

describe("answerPreviousUserSteps with OpenAI API", () => {
	it("processes input and saves output to file", async () => {
	  // Load inputs
	  const inputData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  
	  const { 
		videoKnowledgeInput, 
		realityImageBase64, 
		voiceInputTranscript, 
		memoryKv, 
		userStepMemory 
	  } = inputData;
  
	  // Call the function
	  const result = await answerPreviousUserSteps(
		videoKnowledgeInput, 
		realityImageBase64, 
		voiceInputTranscript, 
		memoryKv, 
		userStepMemory
	  );
  
	  // Write output to file
	  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf-8");
  
	  // Validate results (Optional assertions)
	  expect(result).toBeDefined();
	  expect(result.summary).not.toBe('');
      expect(Object.keys(result).length).toBeGreaterThan(0); // Ensures the result is not empty
	});
});
