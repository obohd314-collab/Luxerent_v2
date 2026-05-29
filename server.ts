import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize the shared Gemini client utility on the server with recommended User-Agent for AI Studio telemetry
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// 1. Health Endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// 2. AI-Powered Property Recommendation Engine
app.post("/api/ai/recommend", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "AI Services are temporarily offline. Please set your GEMINI_API_KEY in the Secrets panel.",
      });
    }

    const { preferences, properties } = req.body;
    
    const systemPrompt = `You are an AI-powered premium real estate analyzer for Nigeria rentals. 
Your objective is to review a series of property renting opportunities and calculate a score (0 to 100) and personalized fit comment for each property based on the user's specific rental preferences. 
Ensure you return results ONLY as a valid JSON array of objects, where each object has fields: "propertyId" (string), "matchScore" (number), and "personalizedInsight" (string). Describe locations in Nigeria context (Lagos, Abuja, Port Harcourt, Ibadan, etc.) accurately.`;

    const userPrompt = `
Preferences of Tenant:
- Ideal Location: ${preferences.location || "Anywhere in Nigeria"}
- Max Budget: \u20a6${preferences.maxPrice || "Unlimited"}
- Minimum Bedrooms: ${preferences.bedrooms || "Any"}
- Ideal Property Type: ${preferences.propertyType || "Any"}
- Desired Amenities: ${preferences.amenities?.join(", ") || "No specific limit"}

Available Property Listings:
${JSON.stringify(properties, null, 2)}

Evaluate each available property listing. Calculate the matchScore representing suitability (budget, layout, amenities, area vibe). Provide a highly human, premium, engaging personal insight explaining why it's a good match or pointing out tradeoffs. Make it sound like a top-tier startup leasing advisor!`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              propertyId: { type: Type.STRING, description: "ID of the evaluated property." },
              matchScore: { type: Type.INTEGER, description: "Calculated match rate percentage from 0 to 100." },
              personalizedInsight: { type: Type.STRING, description: "Insightful paragraph for the prospective tenant." },
            },
            required: ["propertyId", "matchScore", "personalizedInsight"],
          },
        },
      },
    });

    const recommendationText = response.text || "[]";
    res.json(JSON.parse(recommendationText.trim()));
  } catch (err: any) {
    console.error("Gemini recommendation route failed: ", err);
    res.status(500).json({ error: "Failed to generate AI recommendation insights", details: err?.message });
  }
});

// 3. AI-Powered Virtual Interactive Property Tour Script Generator
app.post("/api/ai/virtual-tour", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "AI Services are temporarily offline. Please configure GEMINI_API_KEY.",
      });
    }

    const { property } = req.body;
    
    const prompt = `You are a premium virtual staging voiceover artist. Generate an immersive, highly engaging step-by-step written walkthrough scenario/voiceover for an interactive property tour.
Property Title: ${property.title}
Property Type: ${property.propertyType}
Rooms: ${property.bedrooms} Bedrooms, ${property.bathrooms} Bathrooms
Location: ${property.address}, ${property.location}
Amenities: ${property.amenities?.join(", ")}
Description details: ${property.description}

Generate a JSON object containing:
- intro: High energy, luxury-startup welcoming statement inviting user to explore.
- steps: a detailed list of at least 4 virtual areas corresponding to tour zones of the property (such as "Exterior & Gated Entrance", "Lavish Open-Plan Parlor & Lounge", "Futuristic Culinary Kitchen", "Opulent Ensuite Master Bedroom Suite"). Each zone must have a description of the architectural highlight, design material choices, spatial vibes, and lighting.
- outro: an engaging call to action asking them to book an inspection or chat directly.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intro: { type: Type.STRING },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  zone: { type: Type.STRING, description: "Name of the room or area" },
                  description: { type: Type.STRING, description: "Descriptive spatial walkthrough text" },
                  highlight: { type: Type.STRING, description: "Specific element e.g. floor-to-ceiling luxury tiles" },
                },
                required: ["zone", "description", "highlight"],
              },
            },
            outro: { type: Type.STRING },
          },
          required: ["intro", "steps", "outro"],
        },
      },
    });

    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    console.error("Gemini virtual tour failed: ", err);
    res.status(500).json({ error: "Failed to generate VR tour experience", details: err?.message });
  }
});

// 4. AI Chat Assistant for Specific Listing Concerns
app.post("/api/ai/chat", async (req, res) => {
  try {
    if (!ai) {
      return res.status(503).json({
        error: "AI Services are temporarily offline. Please set your GEMINI_API_KEY in the Secrets panel.",
      });
    }

    const { message, history, property } = req.body;
    
    // Format previous messages for chat
    const chatInstance = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: `You are 'LuxeRent Bot', a friendly, professional AI leasing agent assistant on the PropertyPro Premium rentals portal. 
You are helping a prospective tenant with inquiries about a property:
Title: "${property.title}"
Price: \u20a6${property.price} per year
Location: ${property.address}, ${property.location}
Specs: ${property.bedrooms} Bed, ${property.bathrooms} Bath, ${property.propertyType}
Amenities: ${property.amenities?.join(", ")}
Description: ${property.description}

Keep answers friendly, premium, and focused on helping them rent the listing, schedule inspections, or contact the landlord. Keep replies relatively concise, in standard clean markdown format.`,
      },
    });

    const response = await chatInstance.sendMessage({ message });
    res.json({ reply: response.text });
  } catch (err: any) {
    console.error("AI tenant chat failed: ", err);
    res.status(500).json({ error: "Failed to process chat response from Gemini", details: err?.message });
  }
});

// Vite middleware integration for live preview and routing
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server launched successfully on port ${PORT}`);
});
