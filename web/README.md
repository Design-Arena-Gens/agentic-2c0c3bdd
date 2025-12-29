## Agentic Image + Video Studio

Generate a photorealistic still and an animated cinematic clip from two lightweight prompts. The agent enhances the prompts for realism, streams the image from Pollinations, and crafts a Ken Burns–style motion pass entirely in the browser—no external accounts required.

### ✨ Features

- Prompt enhancer that adds cinematic, realistic descriptors
- Serverless image generation powered by the public Pollinations endpoint
- Client-side video creation using Canvas + MediaRecorder (plays inline & downloadable)
- Responsive, glassmorphism-inspired interface ready for Vercel deployment

### 🚀 Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000` and start iterating in `src/app/page.tsx`.

### 🧪 Production Build

```bash
npm run build
npm run start
```

### 🔧 Configuration

No API keys are required. The video compositor relies on modern browser APIs—ensure MediaRecorder support is available in your target browsers (Chrome, Edge, Firefox 120+).

### 📦 Deployment

The project is optimized for Vercel. Run:

```bash
vercel deploy --prod --yes --token $VERCEL_TOKEN --name agentic-2c0c3bdd
```

After deployment, verify the production URL: `https://agentic-2c0c3bdd.vercel.app`.
