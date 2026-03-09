export interface GenerateResult {
  image: string;
  mimeType: string;
  text: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function generateImage(
  file: File,
  prompt: string,
): Promise<GenerateResult> {
  const imageBase64 = await fileToBase64(file);

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64,
      mimeType: file.type || "image/png",
      prompt,
    }),
  });

  return handleGenerateResponse(res);
}

/** Generate image from text prompt only (no input image). Used e.g. for Vega.IO style scenes. */
export async function generateImageFromPrompt(prompt: string): Promise<GenerateResult> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  return handleGenerateResponse(res);
}

export async function generateImageMulti(
  files: File[],
  prompt: string,
): Promise<GenerateResult> {
  const images = await Promise.all(
    files.map(async (f) => ({
      base64: await fileToBase64(f),
      mimeType: f.type || "image/png",
    })),
  );

  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images,
      prompt,
    }),
  });

  return handleGenerateResponse(res);
}

export interface CatalogProductData {
  page?: string;
  article?: string;
  size?: string;
  price?: string;
}

/** Composes 1, 2, or 4 photos into an A4 catalog layout. Pass textImages and lineTitleImage (base64 PNG from browser canvas) to render CSV data. */
export async function generateCatalogCompose(
  files: File[],
  options?: {
    productData?: CatalogProductData[];
    lineTitle?: string;
    textImages?: string[];
    lineTitleImage?: string;
  }
): Promise<GenerateResult> {
  const images = await Promise.all(
    files.map(async (f) => ({
      base64: await fileToBase64(f),
      mimeType: f.type || "image/png",
    })),
  );

  const body: Record<string, unknown> = { images };
  if (options?.productData?.length) body.productData = options.productData;
  if (options?.lineTitle) body.lineTitle = options.lineTitle;
  if (options?.textImages?.length) body.textImages = options.textImages;
  if (options?.lineTitleImage) body.lineTitleImage = options.lineTitleImage;

  const res = await fetch("/api/catalog-compose", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return handleGenerateResponse(res);
}

async function handleGenerateResponse(res: Response): Promise<GenerateResult> {

  const contentType = res.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      res.status === 413
        ? "Image is too large. Please use an image under 10 MB."
        : `Server error (${res.status}): ${text.slice(0, 120)}`,
    );
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Server error (${res.status})`);
  }

  return data as GenerateResult;
}
