"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loading } from "@/components/States";
import { homePath, useAuth } from "@/lib/auth";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? homePath(user.role) : "/login");
  }, [loading, user, router]);
  return <main className="container"><Loading /></main>;
}
