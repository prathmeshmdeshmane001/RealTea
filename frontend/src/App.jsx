import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import QueryConsole from './components/QueryConsole';
import GraphView from './components/GraphView';
import TraceViewer from './components/TraceViewer';
import DocManager from './components/DocManager';
import PipelineArchitecture from './components/PipelineArchitecture';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('workbench');
  const [health, setHealth] = useState(null);
  const [config, setConfig] = useState(null);
  const [docData, setDocData] = useState(null);
  const [trace, setTrace] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isReindexing, setIsReindexing] = useState(false);
  const [notification, setNotification] = useState(null);

  const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

  const showNotification = (msg, type = 'info') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setHealth(data);
      }
    } catch (e) {
      console.warn("Backend not yet connected:", e);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.warn("Failed to fetch config:", e);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/documents`);
      if (res.ok) {
        const data = await res.json();
        setDocData(data);
      }
    } catch (e) {
      console.warn("Failed to fetch documents:", e);
    }
  };

  useEffect(() => {
    fetchHealth();
    fetchConfig();
    fetchDocuments();
    const timer = setInterval(fetchHealth, 15000);
    return () => clearInterval(timer);
  }, []);

  const handleExecute = async (queryParams) => {
    setIsRunning(true);
    setTrace(null);
    try {
      const res = await fetch(`${API_BASE}/api/crag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(queryParams)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Query execution failed');
      }

      const data = await res.json();
      setTrace(data);
      showNotification(`Query finished with verdict: ${data.verdict}`, 'success');
      fetchHealth();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const handleReindex = async () => {
    setIsReindexing(true);
    try {
      const res = await fetch(`${API_BASE}/api/documents/reindex`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Reindexing failed');
      }
      const data = await res.json();
      showNotification(data.message || 'Documents successfully reindexed!', 'success');
      fetchDocuments();
      fetchHealth();
    } catch (err) {
      showNotification(err.message, 'error');
    } finally {
      setIsReindexing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0e] text-neutral-100 flex flex-col selection:bg-white selection:text-black">
      {/* Floating Header */}
      <Header 
        health={health} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />

      {/* Nokta-style Pill Toast */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className={`nokta-pill-btn px-4 py-2.5 rounded-full border flex items-center space-x-2.5 shadow-2xl ${
            notification.type === 'error'
              ? 'bg-neutral-900 border-rose-500/40 text-rose-300'
              : notification.type === 'success'
              ? 'bg-neutral-900 border-emerald-500/40 text-emerald-300'
              : 'bg-neutral-900 border-neutral-700 text-neutral-200'
          }`}>
            {notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span className="text-xs font-medium font-sans">{notification.msg}</span>
          </div>
        </div>
      )}

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 space-y-7">
        {activeTab === 'workbench' && (
          <div className="space-y-7">
            {/* Query Console */}
            <QueryConsole 
              onExecute={handleExecute} 
              isRunning={isRunning} 
              config={config} 
            />

            {/* Visual LangGraph State Machine */}
            <GraphView 
              executionPath={trace?.execution_path || []} 
              verdict={trace?.verdict || null} 
              isRunning={isRunning} 
            />

            {/* Trace Viewer Tabs */}
            <TraceViewer 
              trace={trace} 
              isRunning={isRunning} 
            />
          </div>
        )}

        {activeTab === 'documents' && (
          <DocManager 
            docData={docData} 
            onReindex={handleReindex} 
            isReindexing={isReindexing} 
          />
        )}

        {activeTab === 'pipeline' && (
          <PipelineArchitecture />
        )}
      </main>

      {/* Footer (Nokta Minimalist) */}
      <footer className="border-t border-neutral-800/80 bg-[#0b0c0e] py-6 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <img src="/logo-badge.png" alt="RealTea" className="w-4 h-4 rounded-full object-contain shrink-0" />
            <span className="text-white font-medium">RealTea</span>
            <span>•</span>
            <span>Minimal Corrective RAG Platform</span>
          </div>
          <div className="font-mono text-[11px] text-neutral-500">
            OpenAI • Gemini 3.6 • DeepSeek • Tavily • FAISS
          </div>
        </div>
      </footer>
    </div>
  );
}
