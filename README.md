# AI Content Engine

AI Content Engine is a full-stack Next.js application that automates short-form video production from a single keyword. It generates multiple scripts, creates voice previews, renders a vertical MP4 with captions, and produces SEO metadata ready for publishing.

The input flow includes a language selector so the generated script, spoken voice output, subtitles, and metadata can stay aligned to English, Hindi, or Hinglish.

## Features

- Step-by-step dashboard for ideation to export
- First-time tutorial block for onboarding
- Open generation flow with login temporarily disabled
- 3 Gemini-generated short video scripts per request
- Language-aware output for English, Hindi, and Hinglish
- 3 Google Cloud Text-to-Speech voice preview variations
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
- Gemini API for scripts and metadata
- Google Cloud Text-to-Speech API for voice generation
- Pexels API for stock footage
- FFmpeg and ffprobe for video composition

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

- `GEMINI_API_KEY`
- `GOOGLE_TTS_API_KEY`, or reuse `GEMINI_API_KEY` if it was created in the same billing-enabled Google Cloud project with Text-to-Speech enabled, or use service-account auth via `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_APPLICATION_CREDENTIALS`
- `PEXELS_API_KEY`

Optional values:

- `GEMINI_MODEL` defaults to `gemini-2.5-flash`
- `GOOGLE_CLOUD_PROJECT_ID` is recommended when using service-account auth for Google TTS
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
   - `GEMINI_API_KEY`
   - `GOOGLE_TTS_API_KEY` or service-account auth variables for Google TTS
   - `PEXELS_API_KEY`
   - `GEMINI_MODEL`
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
  google-auth.ts
  google-tts.ts
  errors.ts
  ffmpeg.ts
  gemini.ts
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

1. `/api/scripts` uses Gemini to create 3 script options.
2. `/api/voices` uses Google Cloud Text-to-Speech to create preview MP3 files.
3. `/api/metadata` uses Gemini to create publishing metadata.
4. `/api/video` downloads stock clips, builds subtitles, and renders the final 30/60-second MP4 with FFmpeg.

## Troubleshooting

- If voice generation fails, confirm Cloud Text-to-Speech is enabled and your Google auth belongs to a billing-enabled project.
- If video rendering fails immediately, verify `ffmpeg` and `ffprobe` can be executed from your shell.
- If stock footage does not appear, check the `PEXELS_API_KEY`. The app will still render with fallback visuals.
- If Gemini requests fail, confirm your model name and API key are valid.
