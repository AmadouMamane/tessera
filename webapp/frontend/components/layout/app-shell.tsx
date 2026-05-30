import type { ReactNode } from "react";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AppShell({ title, description, children }: AppShellProps) {
  return (
    <div className="flex h-full bg-[var(--canvas-sunken,var(--background))]">
      <Sidebar />
      <div className="flex h-full min-h-0 flex-1 flex-col">
        <Topbar title={title} description={description} />
        <main className="bg-canvas-glow min-h-0 flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
