import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

export const maxBodySize = "20mb";

function getApiKey(): string | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

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

const IMAGE_MODEL =
  process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";

async function tryGenerate(
  apiKey: string,
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>,
) {
  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: IMAGE_MODEL,
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
    } else if (imageBase64) {
      parts = buildParts(prompt, imageBase64, mimeType);
    } else {
      parts = [{ text: prompt }];
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Gemini API key is not configured. Add GEMINI_API_KEY to your .env.local file. Get a key at https://aistudio.google.com/apikey",
        },
        { status: 503 },
      );
    }

    let response;
    let lastErr: unknown = null;
    const maxRetries = 2;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        response = await tryGenerate(apiKey, parts);
        break;
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const is429 =
          msg.includes("429") ||
          msg.includes("RESOURCE_EXHAUSTED") ||
          msg.includes("quota") ||
          msg.includes("rate limit");

        if (is429 && attempt < maxRetries) {
          const waitMs = 60_000;
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        const isLeakedKey =
          msg.includes("leaked") ||
          msg.includes("403") ||
          msg.includes("PERMISSION_DENIED");
        const isQuota = msg.includes("429") || msg.includes("quota");

        return NextResponse.json(
          {
            error: isLeakedKey
              ? "Your API key was reported as leaked or invalid. Create a new key at https://aistudio.google.com/apikey and update GEMINI_API_KEY in .env.local"
              : isQuota
                ? "API quota exceeded. Free tier: ~500 images/day. Wait a few minutes or check https://ai.google.dev/gemini-api/docs/rate-limits"
                : msg,
          },
          { status: 502 },
        );
      }
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
