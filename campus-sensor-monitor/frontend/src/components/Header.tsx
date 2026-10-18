"use client";

import React from "react";
import { RefreshCw } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  actions?: React.ReactNode;
}

export function Header({
  title,
  description,
  onRefresh,
  isRefreshing,
  actions,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors disabled:opacity-50"
            title="Refresh data from API"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-slate-500 ${
                isRefreshing ? "animate-spin" : ""
              }`}
            />
            <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
