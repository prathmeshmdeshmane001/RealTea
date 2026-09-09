import os
import glob
from pathlib import Path
from typing import List, Optional, Tuple
import numpy as np

from langchain_community.document_loaders import PyPDFLoader
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

from backend.config import DOCUMENTS_DIR, FAISS_INDEX_DIR, OPENAI_API_KEY, GEMINI_API_KEY
from backend.models import DocStat

_vector_store: Optional[FAISS] = None
_indexed_chunks_count: int = 0

class FastEmbeddingsWrapper(Embeddings):
    """High-speed local direct ONNX embeddings without cloud quota limits or fork issues."""
    def __init__(self, model_name: str = "BAAI/bge-small-en-v1.5"):
        from fastembed import TextEmbedding
        self.fast = TextEmbedding(model_name=model_name)
        self.tokenizer = self.fast.model.tokenizer
        self.model = self.fast.model.model
        self.input_names = [i.name for i in self.model.get_inputs()]

    def _embed_batch(self, texts: List[str]) -> List[List[float]]:
        encoded = self.tokenizer.encode_batch(texts)
        input_ids = np.array([e.ids for e in encoded], dtype=np.int64)
        attention_mask = np.array([e.attention_mask for e in encoded], dtype=np.int64)
        inputs = {'input_ids': input_ids, 'attention_mask': attention_mask}
        if 'token_type_ids' in self.input_names:
            inputs['token_type_ids'] = np.zeros_like(input_ids)
        out = self.model.run(None, inputs)
        # BGE models use normalized CLS pooling
        emb = out[0][:, 0]
        norm = np.linalg.norm(emb, axis=1, keepdims=True)
        emb = emb / np.maximum(norm, 1e-9)
        return emb.tolist()

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        results: List[List[float]] = []
        batch_size = 128
        print(f"Generating local embeddings for {len(texts)} chunks in batches of {batch_size}...")
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            results.extend(self._embed_batch(batch))
            print(f"  [Embeddings] Progress: {min(i + batch_size, len(texts))}/{len(texts)} chunks indexed")
        return results

    def embed_query(self, text: str) -> List[float]:
        return self._embed_batch([text])[0]

class GeminiEmbeddings(Embeddings):
    """Resilient batch embedding client using Google Gemini API."""
    def __init__(self, api_key: str, model: str = "gemini-embedding-001"):
        from google import genai
        self.client = genai.Client(api_key=api_key)
        self.model = model

    def embed_documents(self, texts: List[str]) -> List[List[float]]:
        results: List[List[float]] = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            try:
                res = self.client.models.embed_content(model=self.model, contents=batch)
                for emb in res.embeddings:
                    results.append(emb.values)
            except Exception as e:
                print(f"Batch embed error at index {i}: {e}. Retrying individually...")
                for text in batch:
                    try:
                        res = self.client.models.embed_content(model=self.model, contents=text)
                        results.append(res.embeddings[0].values)
                    except Exception as err2:
                        results.append([0.0] * 3072)
        return results

    def embed_query(self, text: str) -> List[float]:
        res = self.client.models.embed_content(model=self.model, contents=text)
        return res.embeddings[0].values

_cached_embeddings: Optional[Embeddings] = None
_openai_quota_failed: bool = True

def get_embeddings() -> Embeddings:
    global _cached_embeddings, _openai_quota_failed
    if _cached_embeddings is not None:
        return _cached_embeddings

    # 1. Try OpenAI if configured and quota is active
    if OPENAI_API_KEY and not _openai_quota_failed:
        try:
            emb = OpenAIEmbeddings(model="text-embedding-3-large", openai_api_key=OPENAI_API_KEY, max_retries=0)
            emb.embed_query("quota_check")
            _cached_embeddings = emb
            return emb
        except Exception as e:
            _openai_quota_failed = True
            print(f"OpenAIEmbeddings quota check failed: {e}. Switching to local FastEmbed...")

    # 2. Local FastEmbed (direct in-process ONNX, lightning fast, zero quota limits)
    try:
        emb = FastEmbeddingsWrapper()
        _cached_embeddings = emb
        return emb
    except Exception as e:
        print(f"FastEmbed initialization note: {e}")

    # 3. Gemini cloud embeddings fallback
    if GEMINI_API_KEY:
        emb = GeminiEmbeddings(api_key=GEMINI_API_KEY)
        _cached_embeddings = emb
        return emb

    raise RuntimeError("No embedding provider available")

def load_and_chunk_documents() -> Tuple[List[Document], List[DocStat]]:
    pdf_files = sorted(glob.glob(str(DOCUMENTS_DIR / "*.pdf")))
    all_docs: List[Document] = []
    stats: List[DocStat] = []
    
    splitter = RecursiveCharacterTextSplitter(chunk_size=900, chunk_overlap=150)

    for pdf_path in pdf_files:
        p = Path(pdf_path)
        loader = PyPDFLoader(str(p))
        try:
            docs = loader.load()
        except Exception as e:
            print(f"Warning: Failed to load {p.name}: {e}")
            continue

        file_chunks = splitter.split_documents(docs)
        for d in file_chunks:
            d.page_content = d.page_content.encode("utf-8", "ignore").decode("utf-8", "ignore")
            if "source" not in d.metadata:
                d.metadata["source"] = p.name

        all_docs.extend(file_chunks)
        stats.append(DocStat(
            filename=p.name,
            size_bytes=p.stat().st_size,
            page_count=len(docs),
            chunks_count=len(file_chunks)
        ))

    return all_docs, stats

def get_or_create_vector_store(force_reindex: bool = False) -> FAISS:
    global _vector_store, _indexed_chunks_count

    if _vector_store is not None and not force_reindex:
        return _vector_store

    embeddings = get_embeddings()

    # Check if cached FAISS index exists
    index_file = FAISS_INDEX_DIR / "index.faiss"
    if index_file.exists() and not force_reindex:
        try:
            print(f"Loading cached FAISS index from {FAISS_INDEX_DIR}...")
            _vector_store = FAISS.load_local(
                str(FAISS_INDEX_DIR),
                embeddings,
                allow_dangerous_deserialization=True
            )
            _indexed_chunks_count = _vector_store.index.ntotal
            print(f"Loaded {_indexed_chunks_count} indexed chunks from disk cache.")
            return _vector_store
        except Exception as e:
            print(f"Failed to load cached FAISS index: {e}. Rebuilding index...")

    # Build fresh index
    print("Building FAISS index from documents in", DOCUMENTS_DIR)
    chunks, stats = load_and_chunk_documents()
    if not chunks:
        raise RuntimeError(f"No document chunks found in {DOCUMENTS_DIR}")

    print(f"Indexing {len(chunks)} chunks...")
    _vector_store = FAISS.from_documents(chunks, embeddings)
    _indexed_chunks_count = len(chunks)

    # Cache to disk
    FAISS_INDEX_DIR.mkdir(parents=True, exist_ok=True)
    _vector_store.save_local(str(FAISS_INDEX_DIR))
    print(f"Successfully saved FAISS index to {FAISS_INDEX_DIR}")

    return _vector_store

def get_retriever(k: int = 4):
    store = get_or_create_vector_store()
    return store.as_retriever(search_type="similarity", search_kwargs={"k": k})

def get_document_stats() -> List[DocStat]:
    pdf_files = sorted(glob.glob(str(DOCUMENTS_DIR / "*.pdf")))
    stats: List[DocStat] = []
    for pdf_path in pdf_files:
        p = Path(pdf_path)
        try:
            import pypdf
            reader = pypdf.PdfReader(str(p))
            page_count = len(reader.pages)
        except Exception:
            page_count = 0
        stats.append(DocStat(
            filename=p.name,
            size_bytes=p.stat().st_size,
            page_count=page_count,
            chunks_count=0
        ))
    return stats

def get_indexed_chunks_count() -> int:
    global _indexed_chunks_count
    if _vector_store is not None:
        return _vector_store.index.ntotal
    index_file = FAISS_INDEX_DIR / "index.faiss"
    if index_file.exists():
        try:
            store = get_or_create_vector_store()
            return store.index.ntotal
        except Exception:
            pass
    return 0
