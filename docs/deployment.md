# Deployment Guide — RealTea Platform

This guide walks you through deploying **RealTea** to **Netlify** via GitHub and pairing it with a production Python AI backend.

---

## 🏗️ Architecture Overview

| Component | Technology | Recommended Host | Why |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite, Tailwind CSS | **Netlify** | High-speed global edge CDN, automatic preview branches, continuous deployment from GitHub. |
| **Backend API** | FastAPI, LangGraph, FAISS, FastEmbed | **Render / Railway / Fly.io / VPS** | Long-running Python process required for FAISS vector search, local ONNX embeddings, and CRAG StateGraph. |

```
                       [ User Browser ]
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
       [ Netlify CDN ]                 [ Render / Railway ]
    (Frontend: React/Vite)           (Backend: FastAPI/CRAG)
   https://realtea.netlify.app       https://api.realtea.app
              │                               ▲
              └──────── VITE_API_URL ─────────┘
```

---

## 🚀 Part 1: Deploy Frontend to Netlify via GitHub

The repository is already pre-configured with a root [`netlify.toml`](../netlify.toml) and [`frontend/public/_redirects`](../frontend/public/_redirects) for automatic builds and client-side SPA routing.

### Step 1: Log in to Netlify
1. Go to [app.netlify.com](https://app.netlify.com/) and sign in with your GitHub account.

### Step 2: Import Your Repository
1. Click the **"Add new site"** button $\rightarrow$ Select **"Import an existing project"**.
2. Select **GitHub** as your Git provider.
3. Search for and select: `prathmeshmdeshmane001/RealTea`.

### Step 3: Verify Build Settings
Netlify will automatically detect the settings from [`netlify.toml`](../netlify.toml):
- **Base directory**: `frontend`
- **Build command**: `npm run build`
- **Publish directory**: `dist` (or `frontend/dist`)

*(If prompted manually, enter the values above).*

### Step 4: Configure Environment Variables
Under **Site settings** $\rightarrow$ **Environment variables**, click **Add a variable**:
- **Key**: `VITE_API_URL`
- **Value**: Your live backend URL (e.g., `https://realtea-api.onrender.com` or leave empty if using Netlify API proxy).

### Step 5: Deploy
1. Click **"Deploy RealTea"**.
2. Netlify will build the frontend bundle and assign a public URL (e.g. `https://realtea-studio.netlify.app`).

---

## 🐍 Part 2: Deploy the Python Backend (Render Free Tier)

Because the CRAG pipeline uses FAISS vector search and LangGraph state machines, it runs as a persistent service. [Render](https://render.com) offers a free cloud tier that connects directly to GitHub.

### Step 1: Create a Web Service on Render
1. Go to [dashboard.render.com](https://dashboard.render.com/) and sign in with GitHub.
2. Click **New +** $\rightarrow$ **Web Service**.
3. Select your repository: `prathmeshmdeshmane001/RealTea`.

### Step 2: Configure Service Details
- **Name**: `realtea-api`
- **Region**: Nearest to your users (e.g., Oregon, Frankfurt, Singapore)
- **Branch**: `main`
- **Root Directory**: Leave blank (uses repo root)
- **Runtime**: `Python 3` (or `Docker`)
- **Build Command**:
  ```bash
  pip install --upgrade pip && pip install -r requirements.txt
  ```
- **Start Command**:
  ```bash
  python -m uvicorn backend.server:app --host 0.0.0.0 --port $PORT
  ```

### Step 3: Add API Keys (Environment Variables)
In the **Environment Variables** section on Render, add:
- `GEMINI_API_KEY` = your Google Gemini API key
- `TAVILY_API_KEY` = your Tavily search API key
- `OPENAI_API_KEY` = (optional fallback)
- `DEEPSEEK_API_KEY` = (optional fallback)

### Step 4: Click "Create Web Service"
Render will build the dependencies, pre-warm the FAISS index on startup, and provide a live HTTPS URL:
`https://realtea-api.onrender.com`

---

## 🔗 Part 3: Connect Frontend to Backend

1. In your **Netlify Dashboard**, open your site $\rightarrow$ **Site configuration** $\rightarrow$ **Environment variables**.
2. Add / edit `VITE_API_URL`:
   ```
   VITE_API_URL=https://realtea-api.onrender.com
   ```
3. Trigger a redeploy: **Deploys** $\rightarrow$ **Trigger deploy** $\rightarrow$ **Deploy site**.
4. That's it! Your Netlify frontend is now live and talking to your cloud CRAG backend.

---

## 🐳 Alternative: Docker Deployment (Railway / Fly.io / VPS)

If you prefer deploying with Docker, the repository includes a production [`Dockerfile`](../Dockerfile):

```bash
# Build Docker image
docker build -t realtea-backend .

# Run container with environment keys
docker run -p 8080:8080 \
  -e GEMINI_API_KEY="your-gemini-key" \
  -e TAVILY_API_KEY="your-tavily-key" \
  realtea-backend
```
