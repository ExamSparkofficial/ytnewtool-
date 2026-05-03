"use client";

import { useMemo, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { ScriptCard } from "@/components/script-card";
import { StepProgress } from "@/components/step-progress";
import { VoiceCard } from "@/components/voice-card";
import { languageLabels } from "@/lib/types";
import type {
  ContentLanguage,
  DurationOption,
  EngineInput,
  GeneratedMetadata,
  GeneratedScript,
  GeneratedVideo,
  Tone,
  VoiceVariation
} from "@/lib/types";
import { cn } from "@/lib/utils";

const steps = ["Input", "Scripts", "Voice", "Video", "Download"];

const defaultInput: EngineInput = {
  keyword: "",
  tone: "motivational",
  duration: 30,
  language: "english"
};

export function ContentEngine() {
  const [form, setForm] = useState<EngineInput>(defaultInput);
  const [scripts, setScripts] = useState<GeneratedScript[]>([]);
  const [voices, setVoices] = useState<VoiceVariation[]>([]);
  const [metadata, setMetadata] = useState<GeneratedMetadata | null>(null);
  const [video, setVideo] = useState<GeneratedVideo | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string>("");
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(1);
  const [busyStage, setBusyStage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const selectedScript = useMemo(
    () => scripts.find((item) => item.id === selectedScriptId) ?? null,
    [scripts, selectedScriptId]
  );

  const selectedVoice = useMemo(
    () => voices.find((item) => item.id === selectedVoiceId) ?? null,
    [voices, selectedVoiceId]
  );

  function resetFromScripts() {
    setVoices([]);
    setMetadata(null);
    setVideo(null);
    setSelectedVoiceId("");
  }

  async function postJson<T>(url: string, payload: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const json = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      throw new Error(json.error ?? "Request failed.");
    }

    return json;
  }

  async function handleGenerateScripts(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusyStage("Generating script concepts");
    resetFromScripts();
    setScripts([]);
    setSelectedScriptId("");

    try {
      const result = await postJson<{ scripts: GeneratedScript[] }>("/api/scripts", form);
      setScripts(result.scripts);
      setCurrentStep(2);
      if (result.scripts[0]) {
        setSelectedScriptId(result.scripts[0].id);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to generate scripts.");
    } finally {
      setBusyStage("");
    }
  }

  async function handleContinueToVoice() {
    if (!selectedScript) {
      setError("Choose a script before moving to voice generation.");
      return;
    }

    setError("");
    setBusyStage("Generating voice variations and metadata");
    setVoices([]);
    setMetadata(null);
    setVideo(null);
    setSelectedVoiceId("");

    try {
      const [voiceResult, metadataResult] = await Promise.all([
        postJson<{ voices: VoiceVariation[] }>("/api/voices", {
          scriptText: selectedScript.narrationText,
          tone: form.tone,
          language: form.language
        }),
        postJson<{ metadata: GeneratedMetadata }>("/api/metadata", {
          ...form,
          scriptText: selectedScript.narrationText
        })
      ]);

      setVoices(voiceResult.voices);
      setMetadata(metadataResult.metadata);
      setCurrentStep(3);
      if (voiceResult.voices[0]) {
        setSelectedVoiceId(voiceResult.voices[0].id);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Unable to generate voice previews."
      );
    } finally {
      setBusyStage("");
    }
  }

  async function handleRenderVideo() {
    if (!selectedScript || !selectedVoice) {
      setError("Select both a script and a voice before rendering.");
      return;
    }

    setError("");
    setCurrentStep(4);
    setBusyStage("Rendering MP4 with stock footage, captions, and voiceover");
    setVideo(null);

    try {
      const result = await postJson<{ video: GeneratedVideo }>("/api/video", {
        ...form,
        scriptText: selectedScript.narrationText,
        audioAssetKey: selectedVoice.assetKey
      });

      setVideo(result.video);
      setCurrentStep(5);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to render video.");
    } finally {
      setBusyStage("");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header and progress framing */}
      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-panel/80 p-8 shadow-glow backdrop-blur">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(251,113,133,0.16),transparent_28%)]" />
        <div className="absolute inset-0 bg-grid bg-[size:38px_38px] opacity-20" />

        <div className="relative z-10 space-y-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm uppercase tracking-[0.35em] text-sky-200">AI Content Engine</p>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Turn one idea into a short-form video pipeline.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
                Generate scripts, preview synthetic voices, render vertical MP4s, and ship SEO-ready
                metadata from one clean dashboard.
              </p>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-slate-950/35 px-5 py-4 text-sm text-slate-300">
              <p className="font-medium text-white">Workflow</p>
              <p className="mt-1">OpenAI for writing, ElevenLabs for voice, Pexels plus FFmpeg for video.</p>
              <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                Active language: {languageLabels[form.language]}
              </p>
            </div>
          </div>

          <StepProgress currentStep={currentStep} steps={steps} />
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Input and script selection */}
        <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Step 1</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Creative input</h2>
            </div>
            {busyStage ? (
              <span className="rounded-full border border-sky-300/30 bg-sky-300/10 px-4 py-2 text-xs uppercase tracking-[0.22em] text-sky-100">
                {busyStage}
              </span>
            ) : null}
          </div>

          <form className="space-y-5" onSubmit={handleGenerateScripts}>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-200">Keyword</span>
              <input
                value={form.keyword}
                onChange={(event) => setForm((current) => ({ ...current, keyword: event.target.value }))}
                placeholder="ex: discipline habits, side hustle mistakes, founder mindset"
                className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                required
              />
            </label>

            <div className="grid gap-5 md:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Tone</span>
                <select
                  value={form.tone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, tone: event.target.value as Tone }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                >
                  <option value="motivational">Motivational</option>
                  <option value="finance">Finance</option>
                  <option value="storytelling">Storytelling</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Language</span>
                <select
                  value={form.language}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      language: event.target.value as ContentLanguage
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                >
                  <option value="english">English</option>
                  <option value="hindi">Hindi</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-200">Duration</span>
                <select
                  value={form.duration}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      duration: Number(event.target.value) as DurationOption
                    }))
                  }
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                >
                  <option value={30}>30 seconds</option>
                  <option value={60}>60 seconds</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              disabled={Boolean(busyStage)}
              className="inline-flex items-center rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Generate 3 scripts
            </button>
          </form>

          {error ? (
            <div className="mt-5 rounded-2xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="mt-10">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Step 2</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Select a script</h2>
              </div>
              <button
                type="button"
                onClick={handleContinueToVoice}
                disabled={!selectedScript || Boolean(busyStage)}
                className="rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to voice
              </button>
            </div>

            <div className="space-y-4">
              {scripts.length ? (
                scripts.map((script) => (
                  <ScriptCard
                    key={script.id}
                    script={script}
                    selected={selectedScriptId === script.id}
                    onSelect={() => {
                      setSelectedScriptId(script.id);
                      resetFromScripts();
                    }}
                  />
                ))
              ) : (
                <EmptyState description="Your script options will appear here after you submit a keyword." />
              )}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          {/* Voice, render, and export panels */}
          <Panel
            step="Step 3"
            title="Voice previews"
            action={
              <button
                type="button"
                onClick={handleRenderVideo}
                disabled={!selectedVoice || Boolean(busyStage)}
                className="rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Render video
              </button>
            }
          >
            {voices.length ? (
              <div className="space-y-4">
                {voices.map((voice) => (
                  <VoiceCard
                    key={voice.id}
                    voice={voice}
                    selected={selectedVoiceId === voice.id}
                    onSelect={() => setSelectedVoiceId(voice.id)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState description="Voice previews unlock after you choose a script and continue." />
            )}
          </Panel>

          <Panel step="Step 4" title="Video render">
            {video ? (
              <div className="space-y-5">
                <video
                  className="aspect-[9/16] w-full rounded-[28px] border border-white/10 bg-slate-950 object-cover"
                  controls
                  src={video.videoUrl}
                />

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                  <p className="font-medium text-white">
                    {video.usedFallbackVisuals
                      ? "Rendered with fallback abstract visuals because no stock clip was fetched."
                      : "Rendered with stock clips and burned-in subtitles."}
                  </p>
                  {video.credits.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {video.credits.map((credit) => (
                        <a
                          key={`${credit.name}-${credit.url}`}
                          href={credit.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-200 transition hover:bg-slate-900"
                        >
                          Pexels: {credit.name}
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <EmptyState description="The MP4 preview will appear here once the voice track is selected and rendered." />
            )}
          </Panel>

          <Panel step="Step 5" title="Download and metadata">
            {metadata && video ? (
              <div className="space-y-5">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm uppercase tracking-[0.22em] text-slate-400">SEO titles</p>
                  <div className="mt-3 space-y-2">
                    {metadata.titles.map((title, index) => (
                      <div key={title} className="rounded-2xl bg-slate-950/50 px-4 py-3 text-sm text-white">
                        {index + 1}. {title}
                      </div>
                    ))}
                  </div>
                </div>

                <FieldBlock label="Description" value={metadata.description} />
                <FieldBlock label="Tags" value={metadata.tags} />
                <FieldBlock label="Hashtags" value={metadata.hashtags} />

                <div className="flex flex-wrap gap-3">
                  <a
                    href={video.videoUrl}
                    download
                    className="rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
                  >
                    Download video
                  </a>
                  <CopyButton label="title set" value={metadata.titles.join("\n")} />
                  <CopyButton label="description" value={metadata.description} />
                  <CopyButton label="tags" value={metadata.tags} />
                </div>
              </div>
            ) : (
              <EmptyState description="Final assets appear here after metadata generation and video rendering complete." />
            )}
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Panel({
  step,
  title,
  children,
  action
}: {
  step: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-glow backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400">{step}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ description }: { description: string }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 bg-slate-950/35 px-5 py-10 text-center text-sm text-slate-400">
      {description}
    </div>
  );
}

function FieldBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-400">{label}</p>
        <CopyButton label={label.toLowerCase()} value={value} />
      </div>
      <p className={cn("mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-100")}>{value}</p>
    </div>
  );
}
