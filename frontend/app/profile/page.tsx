"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ProfilePage from "@/components/ProfilePage";
import { AuthState, getStoredAuth, saveAuth, logout } from "@/lib/auth";

export default function Page() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      const nextAuth = {
        token,
        user: {
          id: "", 
          email: null,
          display_name: null,
          photo_url: null,
          auth_provider: "token",
          is_guest: false,
          home_currency: "USD",
        },
      } as AuthState;

      saveAuth(nextAuth);
      setAuth(nextAuth);
      router.replace("/profile");
      return;
    }

    setAuth(getStoredAuth());
  }, [searchParams, router]);

  return (
    <ProfilePage
      auth={auth}
      onAuthChange={(newAuth) => {
        setAuth(newAuth);
        if (!newAuth) {
          logout();
        }
      }}
    />
  );
}