"use client";

import Header from "@/app/components/header";
import Sidebar from "@/app/components/sidebar";
import DiceModule from "@/app/components/dice-module";
import NotasWidget from "@/app/components/notas-widget";
import { useAuth } from "@/lib/useAuth";

export default function DadoPage() {
  const { token } = useAuth();

  return (
    <div className="min-h-screen p-6 text-foreground bg-background relative z-10 space-y-4">
      <Header />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="hidden lg:block lg:col-span-3">
          <Sidebar />
        </div>
        <main className="lg:col-span-9 space-y-4">
          <DiceModule token={token} />
          <NotasWidget token={token} />
        </main>
      </div>
    </div>
  );
}
