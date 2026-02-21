import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const API_KEYS = [
  process.env.GEMINI_API_KEY ?? "AIzaSyC85mOpdKjOrvQU0vTT-shNEe4qKELDRnk",
  "AIzaSyDp-siY_MHug6CvkRI5QewAnxPi-N2jDgY",
];

async function tryGenerate(apiKey: string, prompt: string, imageBase64: string, mimeType: string) {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: mimeType || "image/png",
              data: imageBase64,
            },
          },
        ],
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  });

  return response;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType, prompt } = await req.json();

    if (!imageBase64 || !prompt) {
      return NextResponse.json(
        { error: "Missing image or prompt" },
        { status: 400 },
      );
    }

    let response = null;
    let lastError: string | null = null;

    for (const key of API_KEYS) {
      try {
        response = await tryGenerate(key, prompt, imageBase64, mimeType);
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "Unknown error";
        console.error(`API key ending ...${key.slice(-6)} failed:`, lastError);
      }
    }

    if (!response) {
      return NextResponse.json(
        { error: lastError || "All API keys failed" },
        { status: 502 },
      );
    }

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0) {
      return NextResponse.json(
        { error: "No response from Gemini API" },
        { status: 502 },
      );
    }

    const parts = candidates[0].content?.parts ?? [];

    let resultText = "";
    let resultImage: string | null = null;
    let resultMimeType = "image/png";

    for (const part of parts) {
      if (part.text) {
        resultText += part.text;
      } else if (part.inlineData) {
        resultImage = part.inlineData.data ?? null;
        resultMimeType = part.inlineData.mimeType ?? "image/png";
      }
    }

    if (!resultImage) {
      return NextResponse.json(
        { error: resultText || "Gemini did not return an image. Try a different prompt or image." },
        { status: 422 },
      );
    }

    return NextResponse.json({
      image: resultImage,
      mimeType: resultMimeType,
      text: resultText,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    console.error("Generate API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
