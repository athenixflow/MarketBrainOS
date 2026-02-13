const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGeminiCredentials() {
  console.log("Testing Gemini API credentials...");
  
  // Use the provided API key
  const apiKey = "AIzaSyDrDDaXMmKDHea_mXfwh5qZEKok3XENzOw";
  
  if (!apiKey) {
    console.error("❌ No API key provided");
    return;
  }
  
  try {
    console.log("🔧 Initializing GoogleGenerativeAI client...");
    const genAI = new GoogleGenerativeAI(apiKey);
    
    console.log("🤖 Getting generative model...");
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "text/plain",
        maxOutputTokens: 100
      }
    });
    
    console.log("📝 Sending test prompt...");
    const prompt = "Hello! Please respond with a simple 'Hello from Gemini!' to confirm the API is working.";
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("✅ SUCCESS! Gemini API is working correctly.");
    console.log("📤 Response:", text);
    
  } catch (error) {
    console.error("❌ ERROR: Gemini API test failed");
    console.error("Error details:", error.message);
    
    if (error.message.includes("API key")) {
      console.error("🔍 This appears to be an API key authentication issue");
    } else if (error.message.includes("403")) {
      console.error("🔍 This appears to be a permission/authorization issue");
    } else if (error.message.includes("400")) {
      console.error("🔍 This appears to be a bad request issue");
    }
  }
}

// Run the test
testGeminiCredentials();