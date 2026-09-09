import React from 'react';
import { Book, RefreshCw, CheckCircle2, HardDrive, FileText, Database, ShieldCheck } from 'lucide-react';

export default function DocManager({ docData, onReindex, isReindexing }) {
  const documents = docData?.documents || [];
  const totalChunks = docData?.total_chunks || 0;
  const isIndexed = docData?.is_indexed || false;

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Banner (Nokta Editorial Style) */}
      <div className="nokta-card rounded-3xl p-6 sm:p-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
              02 / CORPUS REPOSITORY
            </span>
            <span className="text-neutral-600">•</span>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
              isIndexed 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
            }`}>
              {isIndexed ? '● 1,956 CHUNKS ACTIVE' : '○ PENDING INDEX'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Grounding Knowledge Base
          </h2>
          <p className="text-xs text-neutral-400 max-w-xl font-light">
            Core reference textbooks loaded from <code className="text-neutral-200 font-mono">./corrective-rag-main/documents/</code> used for Top-K semantic similarity.
          </p>
        </div>

        <button
          onClick={onReindex}
          disabled={isReindexing}
          className="nokta-pill-btn px-5 py-2.5 bg-white hover:bg-neutral-200 disabled:opacity-50 text-black text-xs font-semibold flex items-center space-x-2 shadow-lg transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isReindexing ? 'animate-spin' : ''}`} />
          <span>{isReindexing ? 'Rebuilding Index...' : 'Re-index Documents'}</span>
        </button>
      </div>

      {/* Index Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="nokta-card rounded-2xl p-5 space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            DOCUMENT COUNT
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-white">
            0{documents.length}
          </div>
          <div className="text-xs text-neutral-400 font-light">
            Reference literature volumes
          </div>
        </div>

        <div className="nokta-card rounded-2xl p-5 space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            VECTOR CHUNKS
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight text-white">
            {totalChunks.toLocaleString()}
          </div>
          <div className="text-xs text-neutral-400 font-light">
            Split at 900 chars (150 overlap)
          </div>
        </div>

        <div className="nokta-card rounded-2xl p-5 space-y-2">
          <div className="text-[10px] font-mono tracking-widest text-neutral-500 uppercase">
            PERSISTENCE CACHE
          </div>
          <div className="text-sm font-mono tracking-tight text-neutral-200 truncate">
            ./storage/faiss_index/
          </div>
          <div className="text-xs text-neutral-400 font-light">
            Fast cold-start deserialization
          </div>
        </div>
      </div>

      {/* Document Cards (Nokta Project Card Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {documents.map((doc, idx) => (
          <div 
            key={idx}
            className="nokta-card nokta-card-hover rounded-2xl p-6 flex flex-col justify-between space-y-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-400">
                0{idx + 1}
              </span>
              <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
                PDF
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white truncate" title={doc.filename}>
                {doc.filename}
              </h3>
              <p className="text-xs text-neutral-400 font-light">
                {doc.filename === 'book1.pdf' && 'INSPIRED (Marty Cagan)'}
                {doc.filename === 'book2.pdf' && 'Crossing the Chasm (Geoffrey Moore)'}
                {doc.filename === 'book3.pdf' && 'Zero to One (Peter Thiel)'}
              </p>
            </div>

            <div className="pt-4 border-t border-neutral-800/80 flex items-center justify-between text-xs font-mono text-neutral-400">
              <span>{doc.page_count ? `${doc.page_count} Pages` : 'Multi-page'}</span>
              <span>{formatBytes(doc.size_bytes)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
