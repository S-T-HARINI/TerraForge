"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Activity,
  AlertTriangle,
  Sliders,
  Zap,
  ShieldCheck,
  Radio,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api, API_BASE_URL } from "@/lib/api";

const NAV_ITEMS = [
  {
    name: "Overview",
    href: "/",
    icon: LayoutDashboard,
    badge: null,
  },
  {
    name: "Sensor Monitoring",
    href: "/sensors",
    icon: Activity,
    badge: null,
  },
  {
    name: "Alert Management",
    href: "/alerts",
    icon: AlertTriangle,
    badge: null,
  },
  {
    name: "Alert Rules",
    href: "/rules",
    icon: Sliders,
    badge: null,
  },
  {
    name: "Sensor Simulator",
    href: "/simulator",
    icon: Zap,
    badge: "Tool",
  },
  {
    name: "System Health",
    href: "/health",
    icon: ShieldCheck,
    badge: null,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        await api.getHealth();
        if (isMounted) setIsBackendHealthy(true);
      } catch {
        if (isMounted) setIsBackendHealthy(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 border-b border-slate-200 px-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-sm">
            TF
          </div>
          <div>
            <span className="font-semibold text-slate-900 tracking-tight block text-sm">
              TerraForge
            </span>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider uppercase block">
              Campus Monitor
            </span>
          </div>
        </Link>
        <span
          title={
            isBackendHealthy === null
              ? "Connecting..."
              : isBackendHealthy
              ? "Backend API Connected"
              : "Backend API Disconnected"
          }
          className="flex items-center"
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              isBackendHealthy === null
                ? "bg-slate-300"
                : isBackendHealthy
                ? "bg-emerald-500 animate-pulse"
                : "bg-rose-500"
            )}
          />
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase font-mono">
          Dashboard
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors",
                isActive
                  ? "bg-slate-900 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    isActive ? "text-white" : "text-slate-400"
                  )}
                />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    "text-[10px] font-mono px-1.5 py-0.5 rounded",
                    isActive
                      ? "bg-slate-800 text-slate-300"
                      : "bg-slate-100 text-slate-500"
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Backend API Connection Footnote */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
            <Radio className="w-3 h-3 text-slate-400" />
            Backend API
          </span>
          <a
            href={`${API_BASE_URL}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] font-mono text-slate-500 hover:text-slate-900 flex items-center gap-0.5"
            title="Open Swagger API documentation"
          >
            Swagger
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
        <div className="text-[10px] font-mono text-slate-500 truncate" title={API_BASE_URL}>
          {API_BASE_URL}
        </div>
      </div>
    </aside>
  );
}
