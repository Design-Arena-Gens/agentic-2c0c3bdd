"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";

type GenerationResponse = {
  enhancedImagePrompt: string;
  enhancedVideoPrompt: string;
  imageUrl: string;
  generatedAt: string;
};

type VideoResult = {
  url: string;
  blob: Blob;
};

const DEFAULT_IMAGE_PROMPT =
  "a portrait of an astronaut exploring a mossy canyon bathed in sunrise light";
const DEFAULT_VIDEO_PROMPT =
  "slow cinematic reveal of the same astronaut scene with atmospheric motion";

const MEDIA_MIME_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

function getSupportedMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return null;
  }

  for (const mime of MEDIA_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return null;
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load generated image."));
    img.src = src;
  });
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

async function createKenBurnsVideo(imageUrl: string, overlayText: string) {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    throw new Error("Video generation requires a modern browser.");
  }

  const mimeType = getSupportedMimeType();
  if (!mimeType) {
    throw new Error("This browser does not support WebM video recording.");
  }

  const image = await loadImage(imageUrl);
  const maxSize = 768;
  const scaleFactor = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.round(image.width * scaleFactor);
  const height = Math.round(image.height * scaleFactor);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Failed to initialise drawing context.");
  }

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const durationMs = 6000;
  const startScale = 1;
  const endScale = 1.15;
  const panOffset = width * 0.04;

  let animationFrame = 0;

  const cleanup = () => {
    stream.getTracks().forEach((track) => track.stop());
    cancelAnimationFrame(animationFrame);
  };

  const recordingPromise: Promise<VideoResult> = new Promise((resolve, reject) => {
    recorder.onerror = (event) => {
      cleanup();
      reject(event.error ?? new Error("Recording error."));
    };

    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: mimeType });
      resolve({ blob, url: URL.createObjectURL(blob) });
    };
  });

  const startTime = performance.now();

  const renderFrame = (now: number) => {
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    const eased = easeOutCubic(t);
    const scale = startScale + (endScale - startScale) * eased;
    const offsetX = panOffset * eased;
    const offsetY = panOffset * eased * 0.6;

    const drawWidth = width * scale;
    const drawHeight = height * scale;

    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(-(drawWidth - width) / 2 - offsetX, -(drawHeight - height) / 2 - offsetY);
    context.drawImage(image, 0, 0, drawWidth, drawHeight);
    context.restore();

    context.save();
    const gradient = context.createLinearGradient(0, height * 0.7, 0, height);
    gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0.65)");
    context.fillStyle = gradient;
    context.fillRect(0, height * 0.6, width, height * 0.4);

    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.font = `${Math.round(width * 0.04)}px 'Inter', 'Helvetica Neue', sans-serif`;
    context.textBaseline = "bottom";
    context.textAlign = "center";
    const maxWidth = width * 0.9;
    const lines = wrapText(context, overlayText, maxWidth);
    const lineHeight = parseInt(context.font, 10) * 1.35;
    const textStartY = height - lineHeight * 0.4 - (lines.length - 1) * lineHeight;
    lines.forEach((line, index) => {
      context.fillText(line, width / 2, textStartY + index * lineHeight);
    });
    context.restore();

    if (elapsed < durationMs) {
      animationFrame = requestAnimationFrame(renderFrame);
    } else {
      // allow a couple extra frames before stopping to avoid truncation
      setTimeout(() => recorder.stop(), 120);
    }
  };

  recorder.start(200);
  animationFrame = requestAnimationFrame(renderFrame);

  const result = await recordingPromise;
  return result;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [" "];
  }

  const lines: string[] = [];
  let currentLine = words.shift() ?? "";

  for (const word of words) {
    const tentative = `${currentLine} ${word}`;
    if (context.measureText(tentative).width <= maxWidth) {
      currentLine = tentative;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  lines.push(currentLine);
  return lines.slice(0, 3);
}

export default function Home() {
  const [imagePrompt, setImagePrompt] = useState(DEFAULT_IMAGE_PROMPT);
  const [videoPrompt, setVideoPrompt] = useState(DEFAULT_VIDEO_PROMPT);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResponse | null>(null);
  const [videoState, setVideoState] = useState<{
    status: "idle" | "creating" | "ready" | "error";
    url?: string;
    error?: string;
  }>({ status: "idle" });
  const revokeUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (revokeUrlRef.current) {
        URL.revokeObjectURL(revokeUrlRef.current);
      }
    };
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (pending) return;

      setPending(true);
      setError(null);
      setVideoState({ status: "idle" });

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imagePrompt, videoPrompt }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error ?? "Failed to generate media.");
        }

        const data: GenerationResponse = await response.json();
        setResult(data);
        setVideoState({ status: "creating" });

        const video = await createKenBurnsVideo(
          data.imageUrl,
          data.enhancedVideoPrompt,
        );

        if (revokeUrlRef.current) {
          URL.revokeObjectURL(revokeUrlRef.current);
        }
        revokeUrlRef.current = video.url;

        setVideoState({ status: "ready", url: video.url });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong.";
        setError(message);
        setVideoState({ status: "error", error: message });
      } finally {
        setPending(false);
      }
    },
    [imagePrompt, pending, videoPrompt],
  );

  const downloadVideo = useCallback(() => {
    if (!videoState.url) return;
    const anchor = document.createElement("a");
    anchor.href = videoState.url;
    anchor.download = "agentic-video.webm";
    anchor.click();
  }, [videoState.url]);

  const canGenerate = useMemo(() => {
    return Boolean(imagePrompt.trim() || videoPrompt.trim());
  }, [imagePrompt, videoPrompt]);

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} />
      <main className={styles.layout}>
        <header className={styles.hero}>
          <span className={styles.badge}>Agentic Studio</span>
          <h1>Craft realistic imagery and cinematic motion from simple ideas.</h1>
          <p>
            Provide lightweight prompts for an image and an image-to-video
            sequence. The agent enhances them, generates a photorealistic still,
            and crafts a cinematic motion pass—all in the browser.
          </p>
        </header>

        <section className={styles.panel}>
          <form className={styles.form} onSubmit={handleSubmit}>
            <label className={styles.label}>
              Image imagination prompt
              <textarea
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
                placeholder="Describe the image you want to see..."
                rows={3}
                className={styles.input}
              />
            </label>

            <label className={styles.label}>
              Image → video narration
              <textarea
                value={videoPrompt}
                onChange={(event) => setVideoPrompt(event.target.value)}
                placeholder="How should the moment move or feel?"
                rows={3}
                className={styles.input}
              />
            </label>

            <button
              type="submit"
              className={styles.submit}
              disabled={!canGenerate || pending}
            >
              {pending ? "Synthesizing..." : "Generate image & video"}
            </button>

            {error && <p className={styles.error}>{error}</p>}
          </form>

          <aside className={styles.results}>
            {result ? (
              <>
                <div className={styles.promptCard}>
                  <h3>Enhanced prompts</h3>
                  <div>
                    <h4>Image</h4>
                    <p>{result.enhancedImagePrompt}</p>
                  </div>
                  <div>
                    <h4>Video</h4>
                    <p>{result.enhancedVideoPrompt}</p>
                  </div>
                </div>

                <div className={styles.mediaGrid}>
                  <figure className={styles.mediaCard}>
                    <div className={styles.mediaFrame}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={result.imageUrl} alt="Generated visual" />
                    </div>
                    <figcaption>Photorealistic still</figcaption>
                  </figure>

                  <figure className={styles.mediaCard}>
                    <div className={styles.mediaFrame}>
                      {videoState.status === "ready" && videoState.url ? (
                        <video
                          src={videoState.url}
                          controls
                          playsInline
                          loop
                          muted
                        />
                      ) : (
                        <div className={styles.videoPlaceholder}>
                          {videoState.status === "creating"
                            ? "Building cinematic motion..."
                            : videoState.status === "error"
                              ? videoState.error
                              : "Submit prompts to create motion."}
                        </div>
                      )}
                    </div>
                    <figcaption>Cinematic motion pass</figcaption>
                  </figure>
                </div>

                {videoState.status === "ready" && videoState.url && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={downloadVideo}
                  >
                    Download video
                  </button>
                )}
              </>
            ) : (
              <div className={styles.placeholder}>
                <p>
                  Enhance your ideas with richer prompts, then convert the result
                  into a cinematic clip—no external services required.
                </p>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}
