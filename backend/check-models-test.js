import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GOOGLE_API_KEY;

if (!apiKey) {
  console.error("No API KEY found in .env");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
  try {
    // For listing models, we don't need to instantiate a model first.
    // Accessing the model manager directly if exposed, 
    // or just trying a simple generation to see what happens is one way,
    // but the SDK has no direct 'listModels' on the main class in some versions.
    // Actually, looking at SDK docs, usually it's not directly exposed in the high-level helper
    // cleanly in all versions. 
    // However, the error message SUGGESTS "Call ListModels".
    
    // Let's try to infer from common known models.
    console.log("Testing common model names...");
    
    const candidates = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash-001",
        "gemini-pro",
        "gemini-1.0-pro"
    ];

    for (const modelName of candidates) {
        process.stdout.write(`Testing ${modelName}... `);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Test");
            console.log("SUCCESS ✅");
            console.log("Response:", result.response.text());
            return; // Found one!
        } catch (error) {
            console.log("FAILED ❌");
            // console.error(error.message);
        }
    }
    console.log("No common models worked.");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

listModels();
