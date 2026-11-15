"use client";

import React, { useState } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LockScreen } from "@/components/layout/lock-screen";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="flex min-h-screen bg-slate-950 text-slate-100 transition-colors">
          <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
          <div
            className={cn(
              "flex flex-1 flex-col transition-all duration-300 ease-in-out",
              collapsed ? "pl-20" : "pl-64"
            )}
          >
            <Header onToggleSidebar={() => setCollapsed(!collapsed)} />
            <main className="flex-1 p-8 overflow-y-auto">{children}</main>
          </div>
        </div>
        <LockScreen />
      </AuthProvider>
    </ThemeProvider>
  );
}
