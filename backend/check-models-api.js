// check-models-api.js
import fs from 'fs';
import path from 'path';

// Read .env manually to avoid dotenv dependency in this simple script if we want
const envPath = path.resolve('.env');
let apiKey = '';

try {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GOOGLE_API_KEY=(.*)/);
  if (match && match[1]) {
    apiKey = match[1].trim();
  }
} catch (e) {
  console.error("Error reading .env", e);
}

if (!apiKey) {
  console.error("No API KEY found");
  process.exit(1);
}

console.log(`Checking models for API Key: ${apiKey.substring(0, 5)}...`);

async function fetchModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error(text);
      return;
    }
    const data = await response.json();
    if (data.models) {
        console.log("Available models:");
        data.models.forEach(m => {
            if(m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                console.log(`- ${m.name}`);
            }
        });
    } else {
        console.log("No models found in response", data);
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

fetchModels();
