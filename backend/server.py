import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.config import (
    PORT, HOST, OPENAI_API_KEY, GEMINI_API_KEY, TAVILY_API_KEY, DEEPSEEK_API_KEY,
    DEFAULT_UPPER_TH, DEFAULT_LOWER_TH, FAISS_INDEX_DIR
)
from backend.models import (
    QueryRequest, CRAGTrace, DocumentStatusResponse, HealthResponse
)
from backend.vector_store import (
    get_or_create_vector_store, get_document_stats, get_indexed_chunks_count
)
from backend.crag_engine import run_crag_pipeline, get_gemini_client

app = FastAPI(
    title="RealTea Studio API",
    description="Production API for Corrective Retrieval-Augmented Generation (CRAG)",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    """Pre-warm the vector store and HTTP client to eliminate cold-start latency on first user query."""
    try:
        get_or_create_vector_store()
    except Exception as e:
        print(f"[Warning] Failed to pre-warm vector store: {e}")
    try:
        get_gemini_client()
    except Exception as e:
        print(f"[Warning] Failed to pre-warm Gemini client: {e}")


@app.get("/api/health", response_model=HealthResponse)
def health_check():
    indexed_count = get_indexed_chunks_count()
    return HealthResponse(
        status="healthy",
        openai_configured=bool(OPENAI_API_KEY),
        gemini_configured=bool(GEMINI_API_KEY),
        tavily_configured=bool(TAVILY_API_KEY),
        deepseek_configured=bool(DEEPSEEK_API_KEY),
        vector_store_ready=indexed_count > 0 or (FAISS_INDEX_DIR / "index.faiss").exists(),
        indexed_chunks=indexed_count,
    )

@app.get("/api/config")
def get_config():
    return {
        "default_upper_th": DEFAULT_UPPER_TH,
        "default_lower_th": DEFAULT_LOWER_TH,
        "models": [
            {"id": "gemini", "name": "Google Gemini 3.5 Flash Lite", "recommended": True, "available": bool(GEMINI_API_KEY)},
            {"id": "openai", "name": "OpenAI GPT-4o-mini", "recommended": False, "available": bool(OPENAI_API_KEY)},
            {"id": "deepseek", "name": "DeepSeek Chat", "recommended": False, "available": bool(DEEPSEEK_API_KEY)},
        ],
        "default_provider": "gemini" if GEMINI_API_KEY else "openai"
    }

@app.get("/api/documents", response_model=DocumentStatusResponse)
def list_documents():
    stats = get_document_stats()
    indexed_count = get_indexed_chunks_count()
    return DocumentStatusResponse(
        is_indexed=indexed_count > 0,
        total_documents=len(stats),
        total_chunks=indexed_count,
        documents=stats,
        index_path=str(FAISS_INDEX_DIR)
    )

@app.post("/api/documents/reindex")
def reindex_documents():
    try:
        store = get_or_create_vector_store(force_reindex=True)
        return {
            "status": "success",
            "message": f"Successfully indexed {store.index.ntotal} chunks",
            "total_chunks": store.index.ntotal
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/crag/query", response_model=CRAGTrace)
def execute_query(req: QueryRequest):
    print(f"--> [API] Received CRAG query: {req.question[:60]}... (provider={req.get_provider()})", flush=True)
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    try:
        trace = run_crag_pipeline(req)
        print(f"--> [API] Completed CRAG query: verdict={trace.verdict}, path={trace.execution_path}", flush=True)
        return trace
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# Static frontend assets mount and SPA fallback
dist_dir = Path(__file__).resolve().parent.parent / "frontend" / "dist"
assets_dir = dist_dir / "assets"

if assets_dir.exists():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

@app.get("/")
def serve_index():
    index_file = dist_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return {"message": "RealTea Studio API Running. Frontend build in frontend/dist."}

@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    target_file = dist_dir / full_path
    if target_file.is_file():
        return FileResponse(str(target_file))
    index_file = dist_dir / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    raise HTTPException(status_code=404, detail="Page not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host=HOST, port=PORT, reload=True)
