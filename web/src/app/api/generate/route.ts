import { NextResponse } from "next/server";

type GenerateRequest = {
  imagePrompt: string;
  videoPrompt: string;
};

const IMAGE_PHRASES = [
  "hyper-realistic",
  "detailed textures",
  "cinematic lighting",
  "shallow depth of field",
  "8k resolution",
  "photographic clarity",
  "volumetric light",
];

const VIDEO_PHRASES = [
  "cinematic camera motion",
  "smooth parallax movement",
  "immersive atmosphere",
  "dynamic lighting shifts",
  "high fidelity detail",
  "subtle camera dolly",
];

function normalizePrompt(raw: string) {
  return raw.replace(/\s+/g, " ").trim();
}

function enhancePrompt(input: string, type: "image" | "video") {
  const cleaned = normalizePrompt(input);
  const base = cleaned ? cleaned : "a detailed cinematic scene";
  const booster = type === "image" ? IMAGE_PHRASES : VIDEO_PHRASES;
  const flavor = booster
    .slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .join(", ");
  return `${base}, ${flavor}`;
}

function buildImageUrl(prompt: string) {
  const params = new URLSearchParams({
    width: "768",
    height: "768",
    nologo: "true",
    seed: Math.floor(Math.random() * 10_000).toString(),
    ts: Date.now().toString(),
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export async function POST(request: Request) {
  try {
    const { imagePrompt, videoPrompt }: Partial<GenerateRequest> = await request.json();

    if (!imagePrompt && !videoPrompt) {
      return NextResponse.json(
        { error: "Provide at least one prompt to generate media." },
        { status: 400 },
      );
    }

    const enhancedImagePrompt = enhancePrompt(imagePrompt ?? "", "image");
    const enhancedVideoPrompt = enhancePrompt(videoPrompt ?? imagePrompt ?? "", "video");
    const imageUrl = buildImageUrl(enhancedImagePrompt);

    return NextResponse.json({
      enhancedImagePrompt,
      enhancedVideoPrompt,
      imageUrl,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Generation failed", error);
    return NextResponse.json(
      { error: "Failed to generate media. Try again in a moment." },
      { status: 500 },
    );
  }
}
