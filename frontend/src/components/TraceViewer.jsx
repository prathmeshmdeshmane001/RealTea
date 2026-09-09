import React, { useState } from 'react';
import { 
  FileText, CheckCircle2, AlertTriangle, XCircle, Globe, Filter, 
  Code, ExternalLink, Sparkles, Check, X, BookOpen, Clock, Zap
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function TraceViewer({ trace, isRunning }) {
  const [activeTab, setActiveTab] = useState('answer');

  if (isRunning) {
    return (
      <div className="nokta-card rounded-3xl p-10 text-center space-y-4">
        <div className="inline-flex p-3 rounded-full bg-neutral-900 border border-neutral-700 text-white animate-pulse">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white tracking-tight">
            Brewing RealTea Response...
          </h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 font-light">
            Retrieving textbook chunks from FAISS, judging relevance with LLM evaluator, and stripping out hallucinations...
          </p>
        </div>
        <div className="flex justify-center space-x-2 pt-2">
          <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
          <span className="w-2 h-2 rounded-full bg-neutral-400 animate-ping delay-100"></span>
          <span className="w-2 h-2 rounded-full bg-neutral-600 animate-ping delay-200"></span>
        </div>
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="nokta-card rounded-3xl p-12 text-center space-y-3">
        <div className="inline-flex p-3 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
          <Sparkles className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-neutral-200">
          Ready for Inquiry
        </h3>
        <p className="text-xs text-neutral-500 max-w-sm mx-auto font-light">
          Ask a question or select an explore prompt above to observe Corrective RAG across retrieval, scoring, sentence strip filtering, and web fallback.
        </p>
      </div>
    );
  }

  const {
    question,
    model_used,
    verdict,
    verdict_reason,
    answer,
    doc_evaluations = [],
    web_query,
    web_docs = [],
    all_strips = [],
    kept_strips = [],
    refined_context,
    execution_path = [],
    duration_ms = 0
  } = trace;

  const getVerdictBadge = () => {
    switch (verdict) {
      case 'CORRECT':
        return (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="font-semibold uppercase tracking-wider">CORRECT</span>
          </div>
        );
      case 'AMBIGUOUS':
        return (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className="font-semibold uppercase tracking-wider">AMBIGUOUS</span>
          </div>
        );
      case 'INCORRECT':
      default:
        return (
          <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            <span className="font-semibold uppercase tracking-wider">INCORRECT</span>
          </div>
        );
    }
  };

  return (
    <div className="nokta-card rounded-3xl overflow-hidden">
      {/* Verdict & Metrics Bar */}
      <div className="p-6 bg-neutral-950/70 border-b border-neutral-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          {getVerdictBadge()}
          <div>
            <div className="text-xs font-medium text-neutral-200">
              {verdict_reason || 'Evaluator processed candidate chunks.'}
            </div>
            <div className="text-[11px] text-neutral-400 flex items-center space-x-2 mt-0.5 font-mono">
              <span>Engine: <strong className="text-neutral-200 font-sans">{model_used}</strong></span>
              <span>•</span>
              <span>Duration: <strong className="text-neutral-200">{(duration_ms / 1000).toFixed(2)}s</strong></span>
              <span>•</span>
              <span>Path: <span className="text-neutral-300">{execution_path.join(' ➜ ')}</span></span>
            </div>
          </div>
        </div>

        {/* Nokta-style Capsule Tab Navigation */}
        <div className="flex items-center space-x-1 bg-neutral-900/90 p-1 rounded-full border border-neutral-800">
          <button
            onClick={() => setActiveTab('answer')}
            className={`nokta-pill-btn px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
              activeTab === 'answer'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Answer</span>
          </button>

          <button
            onClick={() => setActiveTab('evaluations')}
            className={`nokta-pill-btn px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
              activeTab === 'evaluations'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Chunks ({doc_evaluations.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('refine')}
            className={`nokta-pill-btn px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
              activeTab === 'refine'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Strips ({kept_strips.length}/{all_strips.length})</span>
          </button>

          {(web_query || web_docs.length > 0) && (
            <button
              onClick={() => setActiveTab('web')}
              className={`nokta-pill-btn px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
                activeTab === 'web'
                  ? 'bg-white text-black shadow-sm font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web ({web_docs.length})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('json')}
            className={`nokta-pill-btn px-3.5 py-1.5 rounded-full text-xs font-medium flex items-center space-x-1.5 transition-all ${
              activeTab === 'json'
                ? 'bg-white text-black shadow-sm font-semibold'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Trace JSON</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="p-6 sm:p-8">
        {/* Tab 1: Synthesized Answer */}
        {activeTab === 'answer' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
              <div className="text-xs text-neutral-400 uppercase tracking-widest font-mono font-semibold">
                Synthesized Grounded Truth
              </div>
              <div className="text-[11px] font-mono text-neutral-500">
                Grounding: {verdict === 'CORRECT' ? 'Internal PDF Chunks' : verdict === 'INCORRECT' ? 'Tavily Live Web' : 'Hybrid (Internal + Web)'}
              </div>
            </div>
            
            <div className="text-neutral-100 leading-relaxed text-sm font-sans bg-neutral-950/60 p-6 sm:p-7 rounded-2xl border border-neutral-800/80">
              <MarkdownRenderer content={answer} />
            </div>

            {/* Grounding Context Snippet */}
            <div className="mt-5 pt-4 border-t border-neutral-800/70">
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-400 mb-2">
                Distilled Context Strips Provided to Generator:
              </div>
              <div className="text-xs font-mono text-neutral-300 bg-neutral-950 p-4 rounded-xl border border-neutral-800 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {refined_context || "No context strips retained."}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Document Chunks & Evaluation Scores */}
        {activeTab === 'evaluations' && (
          <div className="space-y-4">
            <div className="text-xs text-neutral-400 uppercase tracking-widest font-mono font-semibold">
              Retrieved Chunks &amp; Relevance Judgments
            </div>

            <div className="grid grid-cols-1 gap-4">
              {doc_evaluations.map((item, idx) => (
                <div 
                  key={idx}
                  className={`p-5 rounded-2xl border transition-all ${
                    item.passed_upper
                      ? 'bg-neutral-950/80 border-emerald-500/40'
                      : item.passed_lower
                      ? 'bg-neutral-950/80 border-amber-500/40'
                      : 'bg-neutral-950/40 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-semibold text-neutral-200">CHUNK #{item.chunk_index}</span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 font-mono border border-neutral-800">
                        {item.source} {item.page ? `• p. ${item.page}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-mono text-neutral-500 uppercase">SCORE:</span>
                      <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        item.passed_upper
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                          : item.passed_lower
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/40'
                          : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                      }`}>
                        {item.score} / 1.0
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-300 bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800/80 mb-3 font-mono leading-relaxed">
                    {item.content}
                  </p>

                  <div className="text-xs text-neutral-400 flex items-start space-x-2">
                    <span className="font-semibold text-neutral-300 font-mono">REASON:</span>
                    <span>{item.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Sentence Decomposition & Knowledge Refinement */}
        {activeTab === 'refine' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs text-neutral-400 uppercase tracking-widest font-mono font-semibold">
                  Sentence Strip Decomposition &amp; Filtration
                </div>
                <p className="text-xs text-neutral-500 mt-0.5 font-light">
                  CRAG separates candidate texts into discrete sentences and filters out noise to eliminate hallucinations.
                </p>
              </div>
              <div className="text-xs font-mono text-neutral-400">
                Verified: <strong className="text-emerald-400">{kept_strips.length}</strong> / Total: <strong className="text-neutral-200">{all_strips.length}</strong>
              </div>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {all_strips.map((sentence, idx) => {
                const isKept = kept_strips.includes(sentence);
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs flex items-start space-x-2.5 transition-all ${
                      isKept
                        ? 'bg-neutral-950 border-emerald-500/30 text-neutral-200'
                        : 'bg-neutral-950/30 border-neutral-900 text-neutral-600 line-through'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isKept ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <X className="w-3.5 h-3.5 text-neutral-600" />
                      )}
                    </div>
                    <div className="flex-1">{sentence}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 4: Web Search Augmentation */}
        {activeTab === 'web' && (
          <div className="space-y-4">
            <div className="text-xs text-neutral-400 uppercase tracking-widest font-mono font-semibold">
              External Web Augmentation (Tavily Fallback)
            </div>

            {web_query && (
              <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800 text-xs flex items-center space-x-2">
                <span className="text-neutral-400 font-mono uppercase text-[10px]">Reformulated Keywords:</span>
                <span className="font-mono text-neutral-100 font-medium">"{web_query}"</span>
              </div>
            )}

            <div className="space-y-3">
              {web_docs.map((doc, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-xs font-semibold text-white flex items-center space-x-1.5">
                      <span>{doc.title}</span>
                    </h4>
                    {doc.url && (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-neutral-400 hover:text-white text-xs flex items-center space-x-1 font-mono"
                      >
                        <span>Visit Source</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-neutral-300 font-light">{doc.snippet}</p>
                  <div className="mt-2 text-[10px] font-mono text-neutral-500 truncate">
                    {doc.url}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 5: Raw JSON Trace */}
        {activeTab === 'json' && (
          <div className="space-y-2">
            <div className="text-xs text-neutral-400 uppercase tracking-widest font-mono font-semibold">
              Complete LangGraph State Machine Payload
            </div>
            <pre className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto max-h-96">
              {JSON.stringify(trace, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
