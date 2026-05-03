"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ConfirmationResult, User } from "firebase/auth";
import {
  RecaptchaVerifier,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut
} from "firebase/auth";

import { firebaseEnvFields } from "@/lib/firebase-config";
import {
  createGoogleProvider,
  getFirebaseAuth,
  isFirebaseConfigured
} from "@/lib/firebase-client";

interface AuthPanelProps {
  onAuthStateChange: (user: User | null) => void;
}

export function AuthPanel({ onAuthStateChange }: AuthPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const isConfigured = useMemo(() => isFirebaseConfigured(), []);
  const isPhoneStepActive = Boolean(confirmationResult);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      onAuthStateChange(null);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthNotice(user ? "Signed in successfully. Generation is now unlocked." : "");
      onAuthStateChange(user);
    });
  }, [hasMounted, onAuthStateChange]);

  useEffect(() => {
    if (!isOpen || !isConfigured || confirmationResult || !hasMounted) {
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth || typeof window === "undefined") {
      return;
    }

    const existing = (window as Window & { vyntrixRecaptcha?: RecaptchaVerifier }).vyntrixRecaptcha;
    if (existing) {
      return;
    }

    const verifier = new RecaptchaVerifier(auth, "phone-recaptcha", {
      size: "normal"
    });

    (window as Window & { vyntrixRecaptcha?: RecaptchaVerifier }).vyntrixRecaptcha = verifier;

    return () => {
      verifier.clear();
      delete (window as Window & { vyntrixRecaptcha?: RecaptchaVerifier }).vyntrixRecaptcha;
    };
  }, [confirmationResult, hasMounted, isConfigured, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function resetPhoneFlow() {
    setConfirmationResult(null);
    setVerificationCode("");
    setPhoneNumber("");
    setAuthError("");
  }

  function normalizePhoneNumber(value: string) {
    const trimmed = value.replace(/\s+/g, "");
    if (!trimmed.startsWith("+")) {
      return `+${trimmed.replace(/[^\d]/g, "")}`;
    }

    return `+${trimmed.slice(1).replace(/[^\d]/g, "")}`;
  }

  async function handleGoogleSignIn() {
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError("Firebase is not configured yet. Add your Firebase web app values first.");
      return;
    }

    setAuthError("");
    setAuthNotice("");
    setIsBusy(true);

    try {
      await signInWithPopup(auth, createGoogleProvider());
      setIsOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePhoneVerification() {
    const auth = getFirebaseAuth();
    const verifier = (window as Window & { vyntrixRecaptcha?: RecaptchaVerifier }).vyntrixRecaptcha;

    if (!auth || !verifier) {
      setAuthError("Firebase phone login is not ready yet. Reopen the login menu and try again.");
      return;
    }

    setAuthError("");
    setAuthNotice("");
    setIsBusy(true);

    try {
      const result = await signInWithPhoneNumber(auth, normalizePhoneNumber(phoneNumber), verifier);
      setConfirmationResult(result);
      setAuthNotice("Verification code sent. Enter the 6-digit OTP to continue.");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Unable to send verification code.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleConfirmCode() {
    if (!confirmationResult) {
      return;
    }

    setAuthError("");
    setAuthNotice("");
    setIsBusy(true);

    try {
      await confirmationResult.confirm(verificationCode);
      resetPhoneFlow();
      setIsOpen(false);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Invalid verification code.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSignOut() {
    const auth = getFirebaseAuth();
    if (!auth) {
      return;
    }

    setIsBusy(true);

    try {
      await signOut(auth);
      setCurrentUser(null);
      onAuthStateChange(null);
      resetPhoneFlow();
      setAuthNotice("You have been signed out.");
      setIsOpen(false);
    } finally {
      setIsBusy(false);
    }
  }

  const profileLabel =
    currentUser?.displayName ?? currentUser?.phoneNumber ?? currentUser?.email ?? "Profile";

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-slate-950/40 px-4 py-3 text-left text-sm text-white transition hover:bg-slate-900/70"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
          {currentUser?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentUser.photoURL} alt="Profile" className="h-full w-full rounded-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-sky-200">
              {currentUser?.displayName?.[0] ?? currentUser?.email?.[0]?.toUpperCase() ?? "V"}
            </span>
          )}
        </span>
        <span>
          <span className="block font-medium">{profileLabel}</span>
          <span className="block text-xs uppercase tracking-[0.2em] text-slate-400">
            {currentUser ? "Signed in" : hasMounted ? "Sign in required" : "Loading"}
          </span>
        </span>
        <span className="text-xs text-slate-400">{isOpen ? "Close" : "Open"}</span>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+12px)] z-30 w-[min(92vw,430px)] rounded-[28px] border border-white/10 bg-slate-950/95 p-5 shadow-glow backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Profile & Setup</p>
              <h3 className="mt-2 text-xl font-semibold text-white">VYNTRIX access control</h3>
            </div>
            {currentUser ? (
              <button
                type="button"
                onClick={handleSignOut}
                disabled={isBusy}
                className="rounded-full border border-white/10 px-3 py-2 text-xs uppercase tracking-[0.2em] text-slate-200 transition hover:bg-white/10 disabled:opacity-60"
              >
                Sign out
              </button>
            ) : null}
          </div>

          {currentUser ? (
            <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
              <p className="font-medium text-white">{currentUser.displayName ?? "Logged in user"}</p>
              <p className="mt-1 text-emerald-100/90">
                {currentUser.phoneNumber ?? currentUser.email ?? currentUser.uid}
              </p>
              <p className="mt-3 text-emerald-100/90">Content generation is now unlocked.</p>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              Users must log in before generating scripts, voice previews, or videos.
            </div>
          )}

          <div className="mt-5 rounded-[24px] border border-white/10 bg-white/5 p-4">
            <p className="text-sm font-medium text-white">Firebase web config placeholders</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {firebaseEnvFields.map((field) => (
                <span
                  key={field}
                  className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-slate-300"
                >
                  {field}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs leading-6 text-slate-400">
              Paste your Firebase web app values into `.env.local`, enable Google and Phone sign-in in the Firebase console, and add your domain to authorized domains for phone auth.
            </p>
          </div>

          {!isConfigured ? (
            <div className="mt-5 rounded-[24px] border border-rose-300/25 bg-rose-400/10 p-4 text-sm text-rose-100">
              Firebase config is missing. Add your `NEXT_PUBLIC_FIREBASE_*` values before trying login.
            </div>
          ) : !currentUser ? (
            <div className="mt-5 space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isBusy}
                className="w-full rounded-full bg-sky-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-200 disabled:opacity-60"
              >
                {isBusy ? "Please wait..." : "Continue with Google"}
              </button>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">Phone number login</p>
                    <p className="mt-1 text-xs leading-6 text-slate-400">
                      Use format like `+91XXXXXXXXXX`. Firebase will show reCAPTCHA before sending the code.
                    </p>
                  </div>
                  {isPhoneStepActive ? (
                    <button
                      type="button"
                      onClick={resetPhoneFlow}
                      className="rounded-full border border-white/10 px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
                    >
                      Reset
                    </button>
                  ) : null}
                </div>

                {authNotice ? (
                  <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
                    {authNotice}
                  </div>
                ) : null}

                {!confirmationResult ? (
                  <>
                    <label className="mt-4 block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                        Mobile number
                      </span>
                      <input
                        value={phoneNumber}
                        onChange={(event) => setPhoneNumber(event.target.value)}
                        placeholder="+91XXXXXXXXXX"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                      />
                    </label>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/35 p-3">
                      <div id="phone-recaptcha" className="overflow-hidden rounded-xl" />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                      <button
                        type="button"
                        onClick={handlePhoneVerification}
                        disabled={isBusy || !phoneNumber.trim()}
                        className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {isBusy ? "Sending code..." : "Send verification code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhoneNumber("+91")}
                        className="rounded-full border border-white/10 px-4 py-3 text-xs uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/10"
                      >
                        Start with +91
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <label className="mt-4 block">
                      <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-400">
                        Verification code
                      </span>
                      <input
                        value={verificationCode}
                        onChange={(event) =>
                          setVerificationCode(event.target.value.replace(/[^\d]/g, "").slice(0, 6))
                        }
                        placeholder="Enter 6-digit code"
                        className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-sky-300/60"
                      />
                    </label>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={handleConfirmCode}
                        disabled={isBusy || verificationCode.trim().length < 6}
                        className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60"
                      >
                        {isBusy ? "Verifying..." : "Verify and continue"}
                      </button>
                      <button
                        type="button"
                        onClick={handlePhoneVerification}
                        disabled={isBusy || !phoneNumber.trim()}
                        className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
                      >
                        Resend code
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : authNotice ? (
            <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
              {authNotice}
            </div>
          ) : null}

          {authError ? (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {authError}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
