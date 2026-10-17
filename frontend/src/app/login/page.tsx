"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandMark } from "@/components/shell/top-nav";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.login(password);
      router.push("/");
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? "Contraseña incorrecta." : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid flex-1 place-items-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5">
        <BrandMark className="text-lg" />
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground">El agente decide qué pagar, qué frenar y qué escalar.</p>
        </div>
        <Input id="password" type="password" autoFocus placeholder="Contraseña" value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }} />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !password}>Entrar</Button>
      </form>
    </main>
  );
}
