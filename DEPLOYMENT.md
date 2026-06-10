# JEE OS - Vercel Deployment & GitHub Preparation Guide

This guide details how to prepare, push, and deploy the JEE OS project onto Vercel, integrating it with Supabase SSR and AI Proxy services.

---

## 📋 Prerequisites

Before deploying, ensure you have:
1. A **GitHub account** with the Git CLI configured locally.
2. A **Vercel account** connected to your GitHub.
3. A **Supabase account** and an active project.
4. API Keys for:
   - **Hack Club AI Proxy**: (Used for streaming AI tutor chat).
   - **Tavily**: (Used for web search capabilities).

---

## 🛠️ Step 1: Database Setup in Supabase

JEE OS uses Supabase PostgreSQL for syncing study logs, revision items, test attempts, profiles, and mistakes.

1. Go to your **Supabase Dashboard** and select your project.
2. Navigate to the **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Open the [supabase_schema.sql](file:///home/ashmilp/Documents/JEE_OS/jee-os/supabase_schema.sql) file in your editor, copy the entire SQL content, and paste it into the Supabase SQL editor.
5. Click **Run**. This will create the required tables (`profiles`, `study_logs`, `revisions`, `test_attempts`, `mistakes`, `topic_status`, etc.) and set up the corresponding row-level security (RLS) policies.

---

## 🔑 Step 2: Environment Variables

You need to configure the following environment variables in Vercel. 

> [!IMPORTANT]
> JEE OS uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (instead of the standard `NEXT_PUBLIC_SUPABASE_ANON_KEY`) for database client authorization. Ensure you name this correctly in Vercel.

| Variable Name | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | The API URL of your Supabase project (from Project Settings > API). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | The anon/public API key of your Supabase project (from Project Settings > API). |
| `HACKCLUB_API_KEY` | Yes | Your API key for the Hack Club AI completion proxy. |
| `TAVILY_API_KEY` | Yes | Your Tavily Search API key for web browsing. |
| `HACKCLUB_MODEL` | No | Model name override (defaults to `google/gemini-3.5-flash`). |

For local development, copy these into a `.env.local` file (which is already gitignored).

---

## 🚀 Step 3: Pushing to GitHub

We have configured `.gitignore` to prevent any temporary agent tools, cache, or build files from leaking into your Git repository.

To push the clean project to GitHub:

1. Initialize git (if not already initialized):
   ```bash
   git init
   ```
2. Verify that untracked junk files are correctly ignored:
   ```bash
   git status
   ```
3. Add the clean project files:
   ```bash
   git add .
   ```
4. Commit your files:
   ```bash
   git commit -m "chore: prepare for vercel deployment and update tsconfig target"
   ```
5. Create a new repository on GitHub (keep it private if you wish to secure your code).
6. Link the local repository to GitHub and push:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

---

## 🌐 Step 4: Deploying on Vercel

1. Go to the **Vercel Dashboard** and click **Add New > Project**.
2. Import your GitHub repository (`YOUR_REPO_NAME`).
3. Under **Build & Development Settings**, keep the defaults:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
4. Expand the **Environment Variables** section.
5. Copy and paste the keys and values from **Step 2**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `HACKCLUB_API_KEY`
   - `TAVILY_API_KEY`
   - `HACKCLUB_MODEL` (Optional)
6. Click **Deploy**. Vercel will build the project, run TypeScript check, compile the assets, and deploy the application.

---

## 🧪 Step 5: Verification & Production Run

Once deployed:
1. Open the Vercel-provided deployment URL.
2. Sign up / Sign in to create a session sync.
3. Check the **Tutor** tab to ensure the AI Tutor streams responses correctly (uses `HACKCLUB_API_KEY`).
4. Attempt a mock test or compile a formula sheet to verify full functionality.
