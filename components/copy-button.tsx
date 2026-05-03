"use client";

import { useState } from "react";

interface CopyButtonProps {
  label: string;
  value: string;
}

export function CopyButton({ label, value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
    >
      {copied ? `${label} copied` : `Copy ${label}`}
    </button>
  );
}
