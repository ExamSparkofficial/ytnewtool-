"use client";

import { useEffect } from "react";

import { initializeFirebaseAnalytics } from "@/lib/firebase-client";

export function FirebaseBootstrap() {
  useEffect(() => {
    void initializeFirebaseAnalytics();
  }, []);

  return null;
}
