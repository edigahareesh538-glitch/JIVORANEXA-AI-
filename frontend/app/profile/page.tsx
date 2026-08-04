"use client";

import { useEffect, useState } from "react";
import ProfilePage from "@/components/ProfilePage";
import { AuthState, getStoredAuth } from "@/lib/auth";

export default function Page() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    setAuth(getStoredAuth());
  }, []);

  return <ProfilePage auth={auth} onAuthChange={setAuth} />;
}