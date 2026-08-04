"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchCurrentUser, saveAuth } from "@/lib/auth";

function ProfileRouteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      router.replace("/");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const user = await fetchCurrentUser(token);
        if (cancelled) return;
        saveAuth({ token, user });
        // Redirect back to main app with profile tab active
        router.replace("/?tab=profile");
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to authenticate session:", err);
        router.replace("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-slate-950">
      <p className="animate-pulse">Completing sign-in...</p>
    </div>
  );
}

export default function ProfileRoute() {
  return (
    <Suspense fallback={null}>
      <ProfileRouteInner />
    </Suspense>
  );
}