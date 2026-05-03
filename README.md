# AI Content Engine

AI Content Engine is a full-stack Next.js application that automates short-form video production from a single keyword. It generates multiple scripts, creates voice previews, renders a vertical MP4 with captions, and produces SEO metadata ready for publishing.

The input flow includes a language selector so the generated script, spoken voice output, subtitles, and metadata can stay aligned to English, Hindi, or Hinglish.

## Features

- Step-by-step dashboard for ideation to export
- First-time tutorial block for onboarding
- Login-gated generation flow with Firebase Authentication
- 3 OpenAI-generated short video scripts per request
- Language-aware output for English, Hindi, and Hinglish
- 2-3 ElevenLabs voice preview variations
- MP4 rendering with FFmpeg, subtitles, and stock footage
- Vercel-compatible runtime storage with Blob-backed media URLs
- Pexels stock clips with automatic fallback visuals if no clip is available
- SEO metadata generation for titles, description, tags, and hashtags
- Download and copy actions for final publishing assets
- Runtime cleanup for generated assets and clear API error handling

## Tech stack

- Next.js 15
- React 19
- Tailwind CSS
- Next.js route handlers for backend APIs
- OpenAI API for scripts and metadata
- ElevenLabs API for voice generation
- Pexels API for stock footage
- FFmpeg and ffprobe for video composition
- Firebase Authentication for Google and phone login

## 1. Install dependencies

```bash
npm install
```

## 2. Install FFmpeg

You need both `ffmpeg` and `ffprobe` available on your machine.

### Windows

1. Install FFmpeg from an official build source such as [gyan.dev](https://www.gyan.dev/ffmpeg/builds/).
2. Add the FFmpeg `bin` folder to your system `PATH`.
3. Verify:

```bash
ffmpeg -version
ffprobe -version
```

If you do not want to add FFmpeg to `PATH`, set `FFMPEG_PATH` and `FFPROBE_PATH` in `.env.local`.

## 3. Configure environment variables

Copy the example file and add your keys:

```powershell
Copy-Item .env.example .env.local
```

Required values:

- `OPENAI_API_KEY`
- `ELEVENLABS_API_KEY`
- `PEXELS_API_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

Optional values:

- `OPENAI_MODEL` defaults to `gpt-4o-mini`
- `ELEVENLABS_MODEL` defaults to `eleven_multilingual_v2`
- `FFMPEG_PATH` defaults to `ffmpeg`
- `FFPROBE_PATH` defaults to `ffprobe`
- `BLOB_READ_WRITE_TOKEN` enables durable runtime media storage on Vercel

## 4. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 5. Production build

```bash
npm run build
npm run start
```

## 6. Vercel deployment

This project is now set up to work on Vercel with these production assumptions:

- FFmpeg falls back to packaged Linux-compatible binaries from `ffmpeg-static` and `ffprobe-static`
- Runtime-generated audio and video files are uploaded to Vercel Blob when `BLOB_READ_WRITE_TOKEN` is present
- Temporary render files use the function scratch space instead of writing to `public/`

Before deploying:

1. Push the repository to GitHub
2. Import the repo into Vercel
3. In Vercel, create a Blob store for the project
4. Confirm `BLOB_READ_WRITE_TOKEN` is available in the project environment variables
5. Add these environment variables in Vercel:
   - `OPENAI_API_KEY`
   - `ELEVENLABS_API_KEY`
   - `PEXELS_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `OPENAI_MODEL`
   - `ELEVENLABS_MODEL`
6. Do not set the Windows-only `FFMPEG_PATH` and `FFPROBE_PATH` values in Vercel unless you intentionally override the packaged Linux binaries

For local development, your existing `.env.local` can still point at the project-local Windows binaries.

## Project structure

```text
app/
  api/
    scripts/
    voices/
    metadata/
    video/
  globals.css
  layout.tsx
  page.tsx
components/
  content-engine.tsx
  copy-button.tsx
  script-card.tsx
  step-progress.tsx
  voice-card.tsx
lib/
  elevenlabs.ts
  errors.ts
  ffmpeg.ts
  openai.ts
  pexels.ts
  prompts.ts
  storage.ts
  subtitles.ts
  types.ts
  validators.ts
public/generated/
runtime/
```

## Notes

- Generated files are written into `public/generated` so the browser can preview and download them.
- Temporary render files are stored in `runtime`.
- Old generated assets are cleaned up automatically.
- If the Pexels API is unavailable or no suitable clip is returned, the app falls back to abstract motion visuals so the render still completes.
- Pexels attribution is surfaced in the UI when stock footage is used.

## API flow

1. `/api/scripts` uses OpenAI to create 3 script options.
2. `/api/voices` uses ElevenLabs to create preview MP3 files.
3. `/api/metadata` uses OpenAI to create publishing metadata.
4. `/api/video` downloads stock clips, builds subtitles, and renders the final MP4 with FFmpeg.

## Troubleshooting

- If login is blocked, confirm Google and Phone sign-in are enabled in Firebase Authentication.
- For phone auth, add your local and production domains to Firebase authorized domains.
- If voice generation fails, confirm your ElevenLabs key has text-to-speech access.
- If video rendering fails immediately, verify `ffmpeg` and `ffprobe` can be executed from your shell.
- If stock footage does not appear, check the `PEXELS_API_KEY`. The app will still render with fallback visuals.
- If OpenAI requests fail, confirm your model name and API key are valid.
