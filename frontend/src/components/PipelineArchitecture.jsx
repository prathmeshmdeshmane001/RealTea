import React from 'react';
import { Layers, Database, CheckSquare, Search, Globe, Filter, FileText, ArrowRight } from 'lucide-react';

export default function PipelineArchitecture() {
  const stages = [
    {
      step: "01",
      title: "Document Ingestion & FAISS Vector Store",
      notebook: "1_basic_rag.ipynb",
      icon: Database,
      description: "Loads reference PDF volumes with PyPDFLoader. Splits content using RecursiveCharacterTextSplitter (chunk_size=900, chunk_overlap=150), cleans surrogates, and persists 1,956 vectors to disk.",
    },
    {
      step: "02",
      title: "Sentence-Level Knowledge Refinement",
      notebook: "2_retrieval_refinement.ipynb",
      icon: Filter,
      description: "Decomposes candidate chunks into discrete sentence strips. An LLM filter judge evaluates and strips out noisy or irrelevant statements to prevent hallucinations.",
    },
    {
      step: "03",
      title: "Retrieval Quality Confidence Evaluator",
      notebook: "3_retrieval_evaluator.ipynb",
      icon: CheckSquare,
      description: "Scores candidate chunks on a continuous scale [0.0, 1.0]. Evaluates confidence against dual thresholds (UPPER_TH = 0.7, LOWER_TH = 0.3) for deterministic graph routing.",
    },
    {
      step: "04",
      title: "Web Search Augmentation Fallback",
      notebook: "4_web_search_refinement.ipynb",
      icon: Globe,
      description: "When internal document retrieval yields INCORRECT (all chunks < 0.3) or AMBIGUOUS (no chunk > 0.7), live Tavily search pulls real-time web documents to bridge knowledge gaps.",
    },
    {
      step: "05",
      title: "Query Reformulation for Web Search",
      notebook: "5_query_rewrite.ipynb",
      icon: Search,
      description: "Transforms conversational questions into keyword-optimized search queries (6–14 words) with recency constraints (e.g. 'last 30 days') to ensure precise search hits.",
    },
    {
      step: "06",
      title: "Unified LangGraph State Machine",
      notebook: "6_ambiguous.ipynb",
      icon: Layers,
      description: "Orchestrates the entire multi-branch workflow with LangGraph StateGraph, conditional edges, knowledge fusion, and final answer generation bounded strictly to verified context.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner (Nokta Editorial Header) */}
      <div className="nokta-card rounded-3xl p-6 sm:p-8 space-y-2">
        <div className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
          03 / ARCHITECTURE BLUEPRINT
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
          The 6-Stage Corrective StateGraph Machine
        </h2>
        <p className="text-xs text-neutral-400 max-w-2xl font-light">
          Faithfully implements the exact data flow, state keys, and prompt logic from the 6 progressive research notebooks in the foundation repository.
        </p>
      </div>

      {/* Grid of Stages (Nokta Service Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div 
              key={idx}
              className="nokta-card nokta-card-hover rounded-2xl p-6 flex flex-col justify-between space-y-6"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-full bg-neutral-900 border border-neutral-800 text-white flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-mono font-bold text-neutral-500">
                    STAGE {stage.step}
                  </span>
                </div>

                <h3 className="text-base font-semibold text-white tracking-tight">
                  {stage.title}
                </h3>
                
                <div className="mt-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                    {stage.notebook}
                  </span>
                </div>

                <p className="text-xs text-neutral-400 mt-3 leading-relaxed font-light">
                  {stage.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
