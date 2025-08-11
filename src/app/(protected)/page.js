"use client";
import { useUser } from "@/components/UserContext";

export default function Page() {
  const user = useUser(); // mindig van

  return (
    <section className="w-full max-w-3xl text-center">
      <h1 className="text-3xl font-bold">
        Welcome, {user?.name || user?.email || user?.preferred_username || "there"} 👋
      </h1>
      <p className="text-muted-foreground mt-2">You are signed in via Entra ID.</p>
    </section>
  );
}
