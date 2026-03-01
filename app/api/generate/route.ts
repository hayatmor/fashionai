import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

const API_KEYS = [
  process.env.GEMINI_API_KEY ?? "AIzaSyBHFHiw6E5xOBZvuvKucSa-HvOLSVVGsIg",
  "AIzaSyDp-siY_MHug6CvkRI5QewAnxPi-N2jDgY",
  "AIzaSyC85mOpdKjOrvQU0vTT-shNEe4qKELDRnk",
];

function buildParts(
  prompt: string,
  imageBase64: string,
  mimeType: string,
): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  return [
    { text: prompt },
    {
      inlineData: {
        mimeType: mimeType || "image/png",
        data: imageBase64,
      },
    },
  ];
}

function buildPartsMulti(
  prompt: string,
  images: Array<{ base64: string; mimeType: string }>,
): Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> {
  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
    { text: prompt },
  ];
  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: img.mimeType || "image/png",
        data: img.base64,
      },
    });
  }
  return parts;
}

async function tryGenerate(
  apiKey: string,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
) {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: [
      {
        role: "user",
        parts,
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
    const body = await req.json();
    const { imageBase64, mimeType, prompt, images } = body;

    const isMulti = Array.isArray(images) && images.length > 0;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing prompt" },
        { status: 400 },
      );
    }

    let parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;

    if (isMulti) {
      if (images.length < 2 || images.length > 10) {
        return NextResponse.json(
          { error: "Multi-image mode requires 2–10 images" },
          { status: 400 },
        );
      }
      parts = buildPartsMulti(prompt, images);
    } else {
      if (!imageBase64) {
        return NextResponse.json(
          { error: "Missing image or prompt" },
          { status: 400 },
        );
      }
      parts = buildParts(prompt, imageBase64, mimeType);
    }

    let response = null;
    let lastError: string | null = null;

    for (const key of API_KEYS) {
      try {
        response = await tryGenerate(key, parts);
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

    const responseParts = candidates[0].content?.parts ?? [];

    let resultText = "";
    let resultImage: string | null = null;
    let resultMimeType = "image/png";

    for (const part of responseParts) {
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
