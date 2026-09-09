import React from 'react';
import { Database, CheckSquare, Search, Globe, Filter, FileText, ArrowRight, CornerDownRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export default function GraphView({ executionPath = [], verdict = null, isRunning = false }) {
  const isNodeActive = (nodeName) => {
    if (!executionPath || executionPath.length === 0) return false;
    return executionPath.includes(nodeName);
  };

  return (
    <div className="nokta-card rounded-3xl p-6 sm:p-7 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800/70">
        <div className="flex items-center space-x-2">
          <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
            01 / PIPELINE FLOW
          </span>
          <span className="text-neutral-600">•</span>
          <span className="text-xs font-medium text-neutral-300">
            CRAG StateGraph Execution
          </span>
        </div>

        {verdict && (
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono text-neutral-500 uppercase">VERDICT:</span>
            {verdict === 'CORRECT' && (
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                CORRECT (Internal Pass)
              </span>
            )}
            {verdict === 'AMBIGUOUS' && (
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mr-1.5"></span>
                AMBIGUOUS (Hybrid Search)
              </span>
            )}
            {verdict === 'INCORRECT' && (
              <span className="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
                INCORRECT (Web Fallback)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Visual Graph Container */}
      <div className="relative overflow-x-auto py-2">
        <div className="min-w-[680px] flex flex-col space-y-4">
          
          {/* Main Primary Row: Retrieve -> Eval */}
          <div className="flex items-center space-x-3">
            {/* Start Node */}
            <div className="px-3.5 py-2.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-mono text-neutral-400 flex items-center space-x-2">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500"></span>
              <span>QUERY</span>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />

            {/* Retrieve Node */}
            <div className={`px-4 py-2.5 rounded-2xl border transition-all ${
              isNodeActive('retrieve')
                ? 'bg-neutral-800/90 border-white text-white shadow-lg'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
            }`}>
              <div className="flex items-center space-x-2.5">
                <Database className="w-4 h-4 text-neutral-300" />
                <div>
                  <div className="text-xs font-medium font-mono">01. RETRIEVE</div>
                  <div className="text-[10px] text-neutral-400 font-sans">FAISS Top-K Search</div>
                </div>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />

            {/* Doc Evaluator Node */}
            <div className={`px-4 py-2.5 rounded-2xl border transition-all ${
              isNodeActive('eval_each_doc')
                ? 'bg-neutral-800/90 border-white text-white shadow-lg'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
            }`}>
              <div className="flex items-center space-x-2.5">
                <CheckSquare className="w-4 h-4 text-neutral-300" />
                <div>
                  <div className="text-xs font-medium font-mono">02. EVALUATE</div>
                  <div className="text-[10px] text-neutral-400 font-sans">LLM Relevance Scorer</div>
                </div>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
            
            {/* Decision Router */}
            <div className="px-3.5 py-1.5 rounded-full bg-neutral-950 border border-neutral-700 text-xs text-neutral-300 font-mono">
              route_after_eval
            </div>
          </div>

          {/* Conditional Branches */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-10 border-l-2 border-neutral-800/90 my-1">
            
            {/* Branch A: CORRECT Path (Internal Only) */}
            <div className={`p-4 rounded-2xl border transition-all ${
              verdict === 'CORRECT'
                ? 'bg-neutral-900 border-emerald-500/50 text-neutral-100 shadow-md'
                : 'bg-neutral-900/30 border-neutral-800/60 text-neutral-500 opacity-60'
            }`}>
              <div className="flex items-center space-x-2 text-xs font-medium mb-1.5 text-emerald-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>BRANCH A: CORRECT (Score &gt; 0.7)</span>
              </div>
              <p className="text-xs text-neutral-400 font-light">
                High confidence match. Proceeds directly to sentence-level refinement using internal textbook chunks.
              </p>
            </div>

            {/* Branch B: INCORRECT / AMBIGUOUS Path (Web Fallback) */}
            <div className={`p-4 rounded-2xl border transition-all ${
              verdict === 'INCORRECT' || verdict === 'AMBIGUOUS'
                ? 'bg-neutral-900 border-neutral-600 text-neutral-100 shadow-md'
                : 'bg-neutral-900/30 border-neutral-800/60 text-neutral-500 opacity-60'
            }`}>
              <div className="flex items-center space-x-2 text-xs font-medium mb-2 text-amber-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                <span>BRANCH B: {verdict || 'INCORRECT / AMBIGUOUS'}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center space-x-1.5 ${
                  isNodeActive('rewrite_query')
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}>
                  <Search className="w-3 h-3" />
                  <span>rewrite_query</span>
                </div>

                <ArrowRight className="w-3 h-3 text-neutral-600" />

                <div className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center space-x-1.5 ${
                  isNodeActive('web_search')
                    ? 'bg-white text-black font-semibold border-white'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}>
                  <Globe className="w-3 h-3" />
                  <span>web_search (Tavily)</span>
                </div>
              </div>
            </div>

          </div>

          {/* Convergence: Refine -> Generate -> End */}
          <div className="flex items-center space-x-3 pt-1">
            <CornerDownRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />

            {/* Knowledge Refine Node */}
            <div className={`px-4 py-2.5 rounded-2xl border transition-all ${
              isNodeActive('refine')
                ? 'bg-neutral-800/90 border-white text-white shadow-lg'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
            }`}>
              <div className="flex items-center space-x-2.5">
                <Filter className="w-4 h-4 text-neutral-300" />
                <div>
                  <div className="text-xs font-medium font-mono">03. REFINE</div>
                  <div className="text-[10px] text-neutral-400 font-sans">Sentence Strip Filtering</div>
                </div>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />

            {/* Generate Node */}
            <div className={`px-4 py-2.5 rounded-2xl border transition-all ${
              isNodeActive('generate')
                ? 'bg-neutral-800/90 border-white text-white shadow-lg'
                : 'bg-neutral-900/60 border-neutral-800 text-neutral-400'
            }`}>
              <div className="flex items-center space-x-2.5">
                <FileText className="w-4 h-4 text-neutral-300" />
                <div>
                  <div className="text-xs font-medium font-mono">04. SYNTHESIZE</div>
                  <div className="text-[10px] text-neutral-400 font-sans">Bounded Knowledge Answer</div>
                </div>
              </div>
            </div>

            <ArrowRight className="w-3.5 h-3.5 text-neutral-600 shrink-0" />

            {/* End Node */}
            <div className={`px-4 py-2 rounded-full border text-xs font-mono font-medium ${
              isNodeActive('generate')
                ? 'bg-white text-black border-white shadow-md'
                : 'bg-neutral-900 border-neutral-800 text-neutral-500'
            }`}>
              END
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
