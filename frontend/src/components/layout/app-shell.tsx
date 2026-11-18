"use client";

import React, { useState, useEffect } from "react";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { LockScreen } from "@/components/layout/lock-screen";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Load sidebar preference from storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("outreach-sidebar-collapsed");
      if (saved !== null) {
        setCollapsed(saved === "true");
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("outreach-sidebar-collapsed", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className="flex min-h-screen bg-background text-foreground transition-colors">
          {/* Main App Navigation Sidebar */}
          <Sidebar
            collapsed={collapsed}
            onToggleCollapse={handleToggleCollapse}
            mobileOpen={mobileOpen}
            onCloseMobile={() => setMobileOpen(false)}
          />

          {/* Main Canvas Area */}
          <div
            className={cn(
              "flex flex-1 flex-col transition-all duration-200 ease-in-out min-w-0",
              collapsed ? "lg:pl-16" : "lg:pl-60"
            )}
          >
            <Header
              onToggleMobileSidebar={() => setMobileOpen((prev) => !prev)}
              onToggleCollapse={handleToggleCollapse}
              isCollapsed={collapsed}
            />
            <main className="flex-1 p-5 sm:p-8 overflow-y-auto">
              <div className="mx-auto max-w-7xl w-full">
                {children}
              </div>
            </main>
          </div>
        </div>
        <LockScreen />
      </AuthProvider>
    </ThemeProvider>
  );
}
