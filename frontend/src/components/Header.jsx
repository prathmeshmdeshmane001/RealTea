import React, { useState, useEffect } from 'react';
import { Sparkles, Globe, Cpu, Database, Clock } from 'lucide-react';

export default function Header({ health, activeTab, setActiveTab }) {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      setCurrentTime(timeStr);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full transition-all">
      <div className="nokta-pill-nav rounded-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Editorial Mark */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm shadow-inner shrink-0">
            <span className="tracking-tighter">RT</span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-base font-semibold tracking-tight text-white">
              RealTea
            </span>
            <span className="text-[10px] tracking-widest uppercase font-mono px-2 py-0.5 rounded-full border border-neutral-700/80 bg-neutral-800/60 text-neutral-300">
              CRAG
            </span>
          </div>
        </div>

        {/* Nokta-style Capsule Navigation */}
        <nav className="flex items-center space-x-1 p-1 rounded-full bg-neutral-950/80 border border-neutral-800/80">
          <button
            onClick={() => setActiveTab('workbench')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'workbench'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            Workbench
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'documents'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            Library
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTab === 'pipeline'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
            }`}
          >
            Blueprint
          </button>
        </nav>

        {/* Nokta Right Section: Live Studio Clock & Pipeline Status */}
        <div className="hidden md:flex items-center space-x-3 text-xs font-mono">
          {/* Live Studio Clock */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800/80 text-neutral-400 text-[11px]">
            <Clock className="w-3 h-3 text-neutral-400" />
            <span>STUDIO {currentTime || '00:00:00'}</span>
          </div>

          {/* Model Status Pill */}
          <div className="flex items-center space-x-2 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800/80 text-neutral-300 text-[11px]">
            <span className={`w-2 h-2 rounded-full ${health?.gemini_configured ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' : 'bg-neutral-600'}`}></span>
            <span className="font-sans font-medium">Gemini 3.6</span>
          </div>

          {/* FAISS Chunks Count Pill */}
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-neutral-900/90 border border-neutral-800/80 text-neutral-400 text-[11px]">
            <Database className="w-3 h-3 text-neutral-400" />
            <span>1,956 Chunks</span>
          </div>
        </div>
      </div>
    </header>
  );
}
