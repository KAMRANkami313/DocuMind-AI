# DocuMind AI

A production-grade Retrieval-Augmented Generation (RAG) application for chatting with your PDF documents. Upload a PDF, ask anything, and get grounded answers with page-level citations.

## Features

- PDF ingestion with overlapping chunking and local transformer embeddings (`all-MiniLM-L6-v2`)
- Semantic vector search via Supabase pgvector
- Streaming LLM responses powered by Groq (`openai/gpt-oss-120b`)
- Inline `[Page X]` citations with a slide-over source drawer
- Smart context strategy — small documents are passed in full; large documents use vector retrieval with intro-page fallback
- In-place editing of past user messages with automatic re-run
- Dynamic follow-up suggestions
- Guest mode (no account required) plus cloud sync via Supabase Auth
- Collapsible, deduplicated citations
- PDF previewer modal

## Tech Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 |
| Database / Auth | Supabase (Postgres + pgvector) |
| LLM | Groq SDK |
| Embeddings | @xenova/transformers (all-MiniLM-L6-v2) |
| PDF parsing | unpdf |
| Icons | lucide-react |
| Markdown | react-markdown + remark-gfm |

## Quick Start

### Prerequisites

- Node.js 20.11+ (see `.nvmrc`)
- A Supabase project with pgvector enabled
- A Groq API key

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
# Fill in NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, and GROQ_API_KEY
```

### 3. Set up the Supabase schema

Run the following SQL in the Supabase SQL editor (enable the `vector` extension first):

```sql
create extension if not exists vector;

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  file_name text not null,
  user_id uuid references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents (id) on delete cascade,
  content text not null,
  page_number int not null,
  embedding vector (384)
);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  citations jsonb,
  created_at timestamptz not null default now()
);

create or replace function match_document_chunks(
  query_embedding vector (384),
  match_threshold float default 0.1,
  match_count int default 8,
  filter_document_id uuid default null
)
returns table (
  id uuid,
  content text,
  page_number int,
  similarity float
)
language sql stable as $$
  select
    dc.id,
    dc.content,
    dc.page_number,
    1 - (dc.embedding <=> query_embedding) as similarity
  from document_chunks dc
  where
    (filter_document_id is null or dc.document_id = filter_document_id)
    and 1 - (dc.embedding <=> query_embedding) > match_threshold
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

create index if not exists document_chunks_embedding_idx
  on document_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists document_chunks_document_id_idx
  on document_chunks (document_id);

create index if not exists chat_messages_document_id_created_at_idx
  on chat_messages (document_id, created_at);
```

### 4. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

## Project Structure

```
src/
  app/
    api/
      upload/route.ts      # PDF ingestion + embedding pipeline
      chat/route.ts        # RAG retrieval + Groq streaming
    globals.css            # Design tokens + base styles
    layout.tsx             # Root layout, providers, fonts
    page.tsx               # Main chat workspace
  components/
    auth/                  # AuthModal
    chat/                  # MessageItem, CitationDrawer
    document/              # FileUpload, PdfPreviewer
    ui/                    # Reusable primitives (Button, Toast, ...)
  lib/
    ai/                    # Groq client + embedding pipeline
    pdf/                   # Extractor + chunker
    supabase/              # Server + client Supabase clients
    utils.ts               # cn() + helpers
    constants.ts           # App-wide constants
    env.ts                 # Validated environment access
  hooks/                   # Custom React hooks
  providers/               # React context providers
  types/                   # TypeScript types
```

## Available Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Run Prettier on the whole project |
| `npm run format:check` | Check formatting without writing |

## Architecture

The RAG pipeline is intentionally simple and grounded:

1. **Ingestion (`/api/upload`)** — the PDF is parsed by `unpdf`, the text is split into 600-character chunks with a 100-character overlap, each chunk is embedded with the local `all-MiniLM-L6-v2` model, and the chunks + embeddings are stored in Supabase.
2. **Retrieval & Generation (`/api/chat`)** — the latest user message is embedded; if the document has ≤35 chunks the entire text is passed to the LLM as context, otherwise the top-8 vector matches plus the first 3 intro pages are passed. Groq streams the response back via Server-Sent Events; the first SSE frame carries the citation metadata.

## Roadmap

See `BATCH_PLAN.md` for the full multi-batch improvement plan covering architecture refactor, security hardening, UX, performance, observability, and testing.

## Contributing

See `CONTRIBUTING.md`.

## License

MIT — see `LICENSE`.