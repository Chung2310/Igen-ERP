import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
dotenv.config();

console.log("Key length:", process.env.GEMINI_API_KEY?.length);
console.log("Key prefix:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 10) : "undefined");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    console.log("Success! Output:", res.text);
  } catch (err) {
    console.error("Error calling Gemini API:", err);
  }
}

run();
