# Corrective Retrieval-Augmented Generation (CRAG) — Research Paper Summary

> **Paper Reference**:  
> **"Corrective Retrieval Augmented Generation"**  
> *Shi-Qi Yan, Jia-Chen Gu, Yun Zhu, Zhen-Hua Ling*  
> *University of Science and Technology of China (USTC) • University of California, Los Angeles (UCLA) • Google DeepMind*  
> **arXiv**: [arXiv:2401.15884v3](https://arxiv.org/abs/2401.15884) `[cs.CL]` (Updated October 2024)  
> **Original Paper PDF**: [`docs/paper/2401.15884v3.pdf`](file:///Users/prathameshdeshmane/corrective%20RAG/docs/paper/2401.15884v3.pdf)  
> **Official Research Codebase**: [github.com/HuskyInSalt/CRAG](https://github.com/HuskyInSalt/CRAG)

---

## 1. Executive Summary & Problem Formulation

Large Language Models (LLMs) inevitably exhibit **hallucinations** because parametric knowledge alone cannot guarantee factual correctness. While conventional **Retrieval-Augmented Generation (RAG)** mitigates this by fetching external documents, standard RAG exhibits **low risk tolerance**:
- **Catastrophic Retrieval Dependency**: If the retriever fetches irrelevant, inaccurate, or outdated context, the generator indiscriminately incorporates these errors, amplifying hallucinations.
- **Coarse-Grained Context Pollution**: Conventional RAG treats entire document passages as indivisible units. Even in generally relevant documents, a large fraction of the content consists of extraneous background or noisy text unhelpful for the specific query.

To address these vulnerabilities, the authors introduce **Corrective Retrieval-Augmented Generation (CRAG)** — a plug-and-play framework designed to self-correct retrieval failures and optimize knowledge utilization.

```
                              [ User Query x ]
                                     │
                                     ▼
                            [ Document Retriever ]
                                     │
                                     ▼
                      Retrieved Documents D = {d1, ..., dk}
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │   Retrieval Evaluator   │ ──► Scores relevance
                        └────────────┬────────────┘     score_i ∈ [-1, 1]
                                     │
                 ┌───────────────────┼───────────────────┐
                 ▼                   ▼                   ▼
           [ CORRECT ]         [ AMBIGUOUS ]       [ INCORRECT ]
          (score > Upper)     (Between bounds)     (All < Lower)
                 │                   │                   │
                 ▼                   │                   ▼
        ┌─────────────────┐          │          ┌─────────────────┐
        │    Knowledge    │          │          │  Query Rewrite  │
        │   Refinement    │          │          │  & Web Search   │
        │ (Sentence Strip │          │          │ (Tavily/Google) │
        │    Decompose-   │          │          └────────┬────────┘
        │   Recompose)    │          │                   │
        └────────┬────────┘          │                   ▼
                 │                   ▼          ┌─────────────────┐
                 │          ┌─────────────────┐ │    External     │
                 │          │  Hybrid Fusion  │ │   Refinement    │
                 │          │  (Internal +    │ └────────┬────────┘
                 │          │   External)     │          │
                 │          └────────┬────────┘          │
                 └───────────────────┼───────────────────┘
                                     │
                                     ▼
                        ┌─────────────────────────┐
                        │     Generator LLM       │
                        │ (Bounded Synthesis y)   │
                        └─────────────────────────┘
```

---

## 2. Core Architectural Pillars

### 2.1. Lightweight Retrieval Evaluator
Rather than relying on massive, expensive LLMs or black-box critics, CRAG employs a specialized evaluator $E$ to assess the quality of each retrieved document $d_i \in D$ relative to input query $x$:
- Each question-document pair $(x, d_i)$ is evaluated individually.
- The evaluator outputs a continuous confidence score $\text{score}_i \in [-1, 1]$ (or $[0.0, 1.0]$ in continuous probability models).
- In the original paper, a fine-tuned **T5-large (0.77B)** model demonstrated superior evaluation accuracy (**84.3%**) compared to few-shot ChatGPT (64.7%) and Chain-of-Thought ChatGPT (62.4%), operating at dramatically lower latency and compute cost.

### 2.2. Tri-Action Trigger Mechanism
CRAG sets two deterministic confidence thresholds: an upper threshold $\alpha$ and a lower threshold $\beta$ (e.g. $\alpha = 0.7$, $\beta = 0.3$). Based on document scores, the pipeline triggers one of three discrete actions:

| Trigger Action | Evaluation Condition | Knowledge Strategy | Operational Rationale |
| :--- | :--- | :--- | :--- |
| **CORRECT** | $\exists \, \text{score}_i \ge \alpha$ | **Internal Document Refinement** | High confidence in internal corpus. Noisy strips are filtered out; verified internal knowledge is preserved. |
| **INCORRECT** | $\forall \, \text{score}_i < \beta$ | **External Web Search Fallback** | All retrieved chunks are irrelevant. Discards internal documents completely to prevent hallucinations and executes real-time web search. |
| **AMBIGUOUS** | Neither condition satisfied | **Hybrid Knowledge Fusion** | Intermediate or uncertain confidence. Combines filtered internal text with external web search evidence to complement coverage. |

### 2.3. Decompose-Then-Recompose Knowledge Refinement
To eliminate non-essential context and extract atomic factual insights:
1. **Decomposition**: The retrieved text is segmented into fine-grained sentence strips (1–2 sentences each).
2. **Scoring & Filtering**: The evaluator scores each strip individually against the query. Strips below a relevance threshold are discarded.
3. **Recomposition**: The retained, high-confidence strips are concatenated in order to form the refined context $k_{in}$.

### 2.4. Query Reformulation & External Knowledge Search
When retrieval is judged `INCORRECT` or `AMBIGUOUS`:
1. **Query Reformulation**: The colloquial user question is rewritten into keyword-dense queries (mimicking search engine best practices) with temporal and recency constraints (e.g. `(last 30 days)`).
2. **Search Retrieval**: A public search API (Google Search API in the paper; Tavily API in RealTea) fetches live web documents.
3. **Web Strip Refinement**: HTML web pages are parsed, segmented into paragraphs, evaluated, and filtered into an external knowledge context $k_{ex}$.

---

## 3. Empirical Results & Benchmark Performance

CRAG was evaluated across four standard natural language benchmarks covering short-form QA, long-form biography generation, health claim verification, and multiple-choice reasoning:

| Benchmark | Task Type | Metric | Standard RAG | Self-RAG | **CRAG (Proposed)** | **Self-CRAG** |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| **PopQA** | Short-form entity QA | Accuracy (%) | 52.8% | 54.9% | **59.8%** (+7.0%) | **61.8%** (+6.9%) |
| **Biography** | Long-form generation | FactScore | 59.2 | 81.2 | **74.1** (+14.9) | **86.2** (+5.0) |
| **PubHealth** | Fact-checking / claims | Accuracy (%) | 39.0% | 72.4% | **75.6%** (+36.6%) | **74.8%** (+2.4%) |
| **Arc-Challenge** | Multiple-choice reasoning | Accuracy (%) | 53.2% | 67.3% | **68.6%** (+15.4%) | **67.2%** |

### Key Takeaways from Paper Ablation Studies:
1. **Every Trigger Action is Crucial**: Removing either `Correct`, `Incorrect`, or `Ambiguous` actions led to significant performance drops. In particular, the `Ambiguous` soft-switch cushions evaluator uncertainty.
2. **Refinement Prevents Hallucination**: Removing sentence-strip refinement degraded accuracy by up to 13.2%, proving that feeding unrefined chunks invites generator distraction.
3. **Search Alone is Insufficient**: Simply appending web search results to standard RAG without the corrective decision gate produced minimal gains, proving that the self-correction mechanism itself drives accuracy.

---

## 4. Mapping the Research Paper to RealTea Implementation

RealTea translates the paper's theoretical framework into a modular, production-ready system:

| Paper Concept | RealTea Implementation | Code Location |
| :--- | :--- | :--- |
| **Retriever $\mathcal{R}$** | FAISS Vector Store + OpenAI Embeddings (`text-embedding-3-small`), chunk size $900$, overlap $150$ | [`backend/vector_store.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/vector_store.py) |
| **Retrieval Evaluator $E$** | Multi-LLM Relevance Judge (Gemini 3.5 Flash Lite / GPT-4o-mini / DeepSeek) scoring $0.0 - 1.0$ | [`backend/crag_engine.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/crag_engine.py#L85-L125) |
| **Action Trigger** | Configurable thresholds `UPPER_TH` (default $0.7$) and `LOWER_TH` (default $0.3$) | [`backend/config.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/config.py#L25-L26) |
| **StateGraph Orchestrator** | LangGraph compiled `StateGraph` with conditional edge routing | [`backend/crag_engine.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/crag_engine.py#L240-L280) |
| **Query Rewriter $W$** | Few-shot keyword generator producing recency-aware queries | [`backend/crag_engine.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/crag_engine.py#L130-L160) |
| **Web Search Fallback** | Tavily Python Search Client fetching raw snippets & URLs | [`backend/crag_engine.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/crag_engine.py#L165-L195) |
| **Decompose & Refine** | Regex sentence decomposition (`[.!?]+`) + strip relevance judge | [`backend/crag_engine.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/crag_engine.py#L200-L240) |
| **Generator $G$** | Strict grounding prompt instructing the LLM to refuse unverified assertions | [`backend/crag_engine.py`](file:///Users/prathameshdeshmane/corrective%20RAG/backend/crag_engine.py#L245-L270) |
