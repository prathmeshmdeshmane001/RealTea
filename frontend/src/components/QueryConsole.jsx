import React, { useState } from 'react';
import { Search, Sparkles, Sliders, ChevronDown, ChevronUp, ArrowRight, BookOpen, Globe, CornerDownLeft } from 'lucide-react';

const SUGGESTED_QUERIES = [
  { label: "Crossing the Chasm Lifecycle", query: "What is crossing the chasm and the technology adoption lifecycle?", type: "book" },
  { label: "Product Discovery (Marty Cagan)", query: "What is product discovery and why is it important in tech products?", type: "book" },
  { label: "Zero to One: Monopoly (Thiel)", query: "What is Peter Thiel's view on competition vs monopoly in Zero to One?", type: "book" },
  { label: "Recent AI News (Web Fallback)", query: "Recent AI news from last week", type: "web" },
  { label: "Batch vs Layer Normalization", query: "Batch normalization vs layer normalization", type: "web" },
];

export default function QueryConsole({ onExecute, isRunning, config }) {
  const [question, setQuestion] = useState("");
  const [modelProvider, setModelProvider] = useState("gemini");
  const [upperTh, setUpperTh] = useState(0.7);
  const [lowerTh, setLowerTh] = useState(0.3);
  const [k, setK] = useState(4);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!question.trim() || isRunning) return;
    onExecute({
      question: question.trim(),
      model_provider: modelProvider,
      upper_th: parseFloat(upperTh),
      lower_th: parseFloat(lowerTh),
      k: parseInt(k, 10),
    });
  };

  const handleSelectSuggested = (q) => {
    setQuestion(q);
  };

  return (
    <div className="nokta-card rounded-3xl p-6 sm:p-8 space-y-6">
      {/* Editorial Header inspired by Nokta */}
      <div className="space-y-2">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full border border-neutral-800 bg-neutral-900/60 text-[11px] font-mono tracking-wider text-neutral-300">
          <img src="/logo-badge.png" alt="RealTea" className="w-4 h-4 rounded-full object-contain" />
          <span>CORRECTIVE RAG ENGINE</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Get the real tea from your knowledge base.
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl font-light">
          Evaluates every document chunk against confidence thresholds, triggers live web searches when internal text is incomplete, and synthesizes pure evidence without hallucinations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Capsule Input Bar (Nokta Style) */}
        <div className="relative flex items-center">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500 z-10">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask anything (e.g. 'Crossing the chasm', 'Product discovery', or 'Recent AI news')..."
            className="w-full pl-14 pr-44 py-4 bg-neutral-900/70 border border-neutral-800 hover:border-neutral-700 focus:border-neutral-500 focus:bg-neutral-900 rounded-full text-neutral-100 placeholder:text-neutral-500 focus:outline-none text-sm transition-all shadow-inner"
            disabled={isRunning}
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center space-x-2">
            <button
              type="submit"
              disabled={isRunning || !question.trim()}
              className="nokta-pill-btn px-5 py-2.5 bg-white hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-semibold flex items-center space-x-2 shadow-lg transition-all"
            >
              {isRunning ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <span>Spill the Tea</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Suggested Prompts Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase mr-1">
            EXPLORE:
          </span>
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggested(sq.query)}
              disabled={isRunning}
              className="nokta-pill-btn px-3.5 py-1.5 rounded-full bg-neutral-900/60 border border-neutral-800/90 hover:border-neutral-600 hover:bg-neutral-800/80 text-xs text-neutral-300 transition-all flex items-center space-x-1.5"
            >
              {sq.type === 'web' ? (
                <Globe className="w-3 h-3 text-neutral-400" />
              ) : (
                <BookOpen className="w-3 h-3 text-neutral-400" />
              )}
              <span>{sq.label}</span>
            </button>
          ))}
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-neutral-800/70">
          {/* Model Selector Pills */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-neutral-400 text-xs font-mono uppercase tracking-wider">ENGINE:</span>
            <div className="inline-flex rounded-full bg-neutral-950 p-1 border border-neutral-800">
              <button
                type="button"
                onClick={() => setModelProvider('gemini')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  modelProvider === 'gemini'
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                Gemini 3.6 Flash
              </button>
              <button
                type="button"
                onClick={() => setModelProvider('openai')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  modelProvider === 'openai'
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                GPT-4o-mini
              </button>
              <button
                type="button"
                onClick={() => setModelProvider('deepseek')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  modelProvider === 'deepseek'
                    ? 'bg-white text-black shadow-sm font-semibold'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                DeepSeek
              </button>
            </div>
          </div>

          {/* Advanced Tuning Toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Threshold Calibration</span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible Advanced Settings (Nokta Editorial Cards) */}
        {showAdvanced && (
          <div className="p-5 bg-neutral-950/80 rounded-2xl border border-neutral-800/80 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs animate-in fade-in duration-200">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-300 font-medium">Upper Threshold (UPPER_TH)</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-emerald-400 border border-neutral-700">
                  {upperTh}
                </span>
              </div>
              <input
                type="range"
                min="0.4"
                max="0.95"
                step="0.05"
                value={upperTh}
                onChange={(e) => setUpperTh(e.target.value)}
                className="w-full accent-white h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">
                Scores &gt; {upperTh} route to CORRECT verdict (direct text synthesis).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-300 font-medium">Lower Threshold (LOWER_TH)</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-amber-400 border border-neutral-700">
                  {lowerTh}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.5"
                step="0.05"
                value={lowerTh}
                onChange={(e) => setLowerTh(e.target.value)}
                className="w-full accent-white h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">
                All scores &lt; {lowerTh} route to INCORRECT (live Tavily fallback).
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-300 font-medium">Top-K Chunks Retrieved</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                  {k}
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="8"
                step="1"
                value={k}
                onChange={(e) => setK(e.target.value)}
                className="w-full accent-white h-1 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <p className="text-[11px] text-neutral-500">
                Number of vector chunks extracted from local FAISS store.
              </p>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
