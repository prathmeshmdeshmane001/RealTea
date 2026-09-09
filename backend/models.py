from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field

class QueryRequest(BaseModel):
    question: str = Field(..., description="The user question for Corrective RAG")
    model_provider: str = Field(default="gemini", description="Model provider: gemini, openai, or deepseek")
    provider: Optional[str] = Field(default=None, description="Alias for model_provider")
    model_name: Optional[str] = Field(default=None, description="Specific model name (optional)")
    upper_th: float = Field(default=0.7, description="Upper threshold for CORRECT verdict")
    lower_th: float = Field(default=0.3, description="Lower threshold for relevant chunk filter")
    k: int = Field(default=4, description="Number of document chunks to retrieve")

    def get_provider(self) -> str:
        return (self.provider or self.model_provider or "gemini").lower()

class DocEvaluationItem(BaseModel):
    chunk_index: int
    content: str
    source: str
    page: Optional[int] = None
    score: float
    reason: str
    passed_lower: bool
    passed_upper: bool

class WebSearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str

class CRAGTrace(BaseModel):
    question: str
    model_used: str
    retrieved_docs: List[Dict[str, Any]]
    doc_evaluations: List[DocEvaluationItem]
    verdict: str
    verdict_reason: str
    web_query: Optional[str] = None
    web_docs: List[WebSearchResultItem] = []
    all_strips: List[str] = []
    kept_strips: List[str] = []
    refined_context: str
    answer: str
    execution_path: List[str]
    duration_ms: float

class DocStat(BaseModel):
    filename: str
    size_bytes: int
    page_count: int
    chunks_count: int

class DocumentStatusResponse(BaseModel):
    is_indexed: bool
    total_documents: int
    total_chunks: int
    documents: List[DocStat]
    index_path: str

class HealthResponse(BaseModel):
    status: str
    openai_configured: bool
    gemini_configured: bool
    tavily_configured: bool
    deepseek_configured: bool
    vector_store_ready: bool
    indexed_chunks: int
