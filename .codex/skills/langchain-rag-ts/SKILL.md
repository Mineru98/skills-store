---
name: langchain-rag-ts
description: "INVOKE THIS SKILL when building ANY retrieval-augmented generation (RAG) system. Covers document loaders, RecursiveCharacterTextSplitter, embeddings (OpenAI), and vector stores (Chroma, FAISS, Pinecone)."
---

<overview>
Retrieval Augmented Generation (RAG) enhances LLM responses by fetching relevant context from external knowledge sources.

**Pipeline:**
1. **Index**: Load → Split → Embed → Store
2. **Retrieve**: Query → Embed → Search → Return docs
3. **Generate**: Docs + Query → LLM → Response

**Key Components:**
- **Document Loaders**: Ingest data from files, web, databases
- **Text Splitters**: Break documents into chunks
- **Embeddings**: Convert text to vectors
- **Vector Stores**: Store and search embeddings
</overview>

<vectorstore-selection>

| Vector Store | Use Case | Persistence |
|--------------|----------|-------------|
| **InMemory** | Testing | Memory only |
| **FAISS** | Local, high performance | Disk |
| **Chroma** | Development | Disk |
| **Pinecone** | Production, managed | Cloud |

</vectorstore-selection>

---

## Complete RAG Pipeline

<ex-basic-rag-setup>
End-to-end RAG pipeline: load documents, split into chunks, embed, store, retrieve, and generate a response.
```typescript
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// 1. Load documents
const docs = [
  new Document({ pageContent: "LangChain is a framework for LLM apps.", metadata: {} }),
  new Document({ pageContent: "RAG = Retrieval Augmented Generation.", metadata: {} }),
];

// 2. Split documents
const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 500, chunkOverlap: 50 });
const splits = await splitter.splitDocuments(docs);

// 3. Create embeddings and store
const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
const vectorstore = await MemoryVectorStore.fromDocuments(splits, embeddings);

// 4. Create retriever
const retriever = vectorstore.asRetriever({ k: 4 });

// 5. Use in RAG
const model = new ChatOpenAI({ model: "gpt-4.1" });
const query = "What is RAG?";
const relevantDocs = await retriever.invoke(query);

const context = relevantDocs.map(doc => doc.pageContent).join("\n\n");
const response = await model.invoke([
  { role: "system", content: `Use this context:\n\n${context}` },
  { role: "user", content: query },
]);
```
</ex-basic-rag-setup>

---

## Document Loaders

<ex-loading-pdf>
Load a PDF file and extract each page as a separate document.
```typescript
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";

const loader = new PDFLoader("./document.pdf");
const docs = await loader.load();
console.log(`Loaded ${docs.length} pages`);
```
</ex-loading-pdf>

<ex-loading-web-pages>
Fetch and parse content from a web URL into a document using Cheerio.
```typescript
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

const loader = new CheerioWebBaseLoader("https://docs.langchain.com");
const docs = await loader.load();
```
</ex-loading-web-pages>

<ex-loading-directory>
</ex-loading-directory>

---

## Text Splitting

<ex-text-splitting>
</ex-text-splitting>

---

## Vector Stores

<ex-chroma-vectorstore>
Create a Chroma vector store connected to a running Chroma server.
```typescript
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";

const vectorstore = await Chroma.fromDocuments(
  splits,
  new OpenAIEmbeddings(),
  { collectionName: "my-collection", url: "http://localhost:8000" }
);
```
</ex-chroma-vectorstore>

<ex-faiss-vectorstore>
Create a FAISS vector store, save it to disk, and reload it.
```typescript
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const vectorstore = await FaissStore.fromDocuments(splits, embeddings);
await vectorstore.save("./faiss_index");

const loaded = await FaissStore.load("./faiss_index", embeddings);
```
</ex-faiss-vectorstore>

---

## Retrieval

<ex-similarity-search>
Perform similarity search and retrieve results with relevance scores.
```typescript
// Basic search
const results = await vectorstore.similaritySearch(query, 5);

// With scores
const resultsWithScore = await vectorstore.similaritySearchWithScore(query, 5);
for (const [doc, score] of resultsWithScore) {
  console.log(`Score: ${score}, Content: ${doc.pageContent}`);
}
```
</ex-similarity-search>

<ex-mmr-search>
</ex-mmr-search>

<ex-metadata-filtering>
</ex-metadata-filtering>

<ex-rag-with-agent>
Create an agent that uses RAG as a tool for answering questions.
```typescript
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const searchDocs = tool(
  async (input) => {
    const docs = await retriever.invoke(input.query);
    return docs.map(d => d.pageContent).join("\n\n");
  },
  {
    name: "search_docs",
    description: "Search documentation for relevant information.",
    schema: z.object({ query: z.string() }),
  }
);

const agent = createAgent({
  model: "gpt-4.1",
  tools: [searchDocs],
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "How do I create an agent?" }],
});
```
</ex-rag-with-agent>

<boundaries>
### What You CAN Configure

- Chunk size/overlap
- Embedding model
- Number of results (k)
- Metadata filters
- Search algorithms: Similarity, MMR

### What You CANNOT Configure

- Embedding dimensions (per model)
- Mix embeddings from different models in same store
</boundaries>

<fix-chunk-size>
Chunk size 500-1500 is typically good.
```typescript
// WRONG: Too small or too large
const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 50 });

// CORRECT
const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
```
</fix-chunk-size>

<fix-chunk-overlap>
</fix-chunk-overlap>

<fix-persist-vectorstore>
Use persistent vector store instead of in-memory to avoid data loss.
```typescript
// WRONG: Memory - lost on restart
const vectorstore = await MemoryVectorStore.fromDocuments(docs, embeddings);

// CORRECT
const vectorstore = await Chroma.fromDocuments(docs, embeddings, { collectionName: "my-collection" });
```
</fix-persist-vectorstore>

<fix-consistent-embeddings>
Use the same embedding model for indexing and querying.
```typescript
const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
const vectorstore = await Chroma.fromDocuments(docs, embeddings);
const retriever = vectorstore.asRetriever();  // Uses same embeddings
```
</fix-consistent-embeddings>

<fix-faiss-deserialization>
</fix-faiss-deserialization>

<fix-dimension-mismatch>
</fix-dimension-mismatch>
