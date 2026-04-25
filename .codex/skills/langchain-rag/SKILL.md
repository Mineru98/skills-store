---
name: langchain-rag
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
```python
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

# 1. Load documents
docs = [
    Document(page_content="LangChain is a framework for LLM apps.", metadata={}),
    Document(page_content="RAG = Retrieval Augmented Generation.", metadata={}),
]

# 2. Split documents
splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
splits = splitter.split_documents(docs)

# 3. Create embeddings and store
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = InMemoryVectorStore.from_documents(splits, embeddings)

# 4. Create retriever
retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

# 5. Use in RAG
model = ChatOpenAI(model="gpt-4.1")
query = "What is RAG?"
relevant_docs = retriever.invoke(query)

context = "\n\n".join([doc.page_content for doc in relevant_docs])
response = model.invoke([
    {"role": "system", "content": f"Use this context:\n\n{context}"},
    {"role": "user", "content": query},
])
```
</ex-basic-rag-setup>

---

## Document Loaders

<ex-loading-pdf>
Load a PDF file and extract each page as a separate document.
```python
from langchain_community.document_loaders import PyPDFLoader

loader = PyPDFLoader("./document.pdf")
docs = loader.load()
print(f"Loaded {len(docs)} pages")
```
</ex-loading-pdf>

<ex-loading-web-pages>
Fetch and parse content from a web URL into a document.
```python
from langchain_community.document_loaders import WebBaseLoader

loader = WebBaseLoader("https://docs.langchain.com")
docs = loader.load()
```
</ex-loading-web-pages>

<ex-loading-directory>
Load all text files from a directory using a glob pattern.
```python
from langchain_community.document_loaders import DirectoryLoader, TextLoader

# Load all text files from directory
loader = DirectoryLoader(
    "path/to/documents",
    glob="**/*.txt",  # Pattern for files to load
    loader_cls=TextLoader
)
docs = loader.load()
```
</ex-loading-directory>

---

## Text Splitting

<ex-text-splitting>
Split documents into chunks using RecursiveCharacterTextSplitter with configurable size and overlap.
```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,        # Characters per chunk
    chunk_overlap=200,      # Overlap for context continuity
    separators=["\n\n", "\n", " ", ""],  # Split hierarchy
)

splits = splitter.split_documents(docs)
```
</ex-text-splitting>

---

## Vector Stores

<ex-chroma-vectorstore>
Create a persistent Chroma vector store and reload it from disk.
```python
from langchain_chroma import Chroma
from langchain_openai import OpenAIEmbeddings

vectorstore = Chroma.from_documents(
    documents=splits,
    embedding=OpenAIEmbeddings(),
    persist_directory="./chroma_db",
    collection_name="my-collection",
)

# Load existing
vectorstore = Chroma(
    persist_directory="./chroma_db",
    embedding_function=OpenAIEmbeddings(),
    collection_name="my-collection",
)
```
</ex-chroma-vectorstore>

<ex-faiss-vectorstore>
Create a FAISS vector store, save it to disk, and reload it.
```python
from langchain_community.vectorstores import FAISS

vectorstore = FAISS.from_documents(splits, embeddings)
vectorstore.save_local("./faiss_index")

# Load (requires allow_dangerous_deserialization)
loaded = FAISS.load_local(
    "./faiss_index",
    embeddings,
    allow_dangerous_deserialization=True
)
```
</ex-faiss-vectorstore>

---

## Retrieval

<ex-similarity-search>
Perform similarity search and retrieve results with relevance scores.
```python
# Basic search
results = vectorstore.similarity_search(query, k=5)

# With scores
results_with_score = vectorstore.similarity_search_with_score(query, k=5)
for doc, score in results_with_score:
    print(f"Score: {score}, Content: {doc.page_content}")
```
</ex-similarity-search>

<ex-mmr-search>
Use MMR (Maximal Marginal Relevance) to balance relevance and diversity in search results.
```python
# MMR balances relevance and diversity
retriever = vectorstore.as_retriever(
    search_type="mmr",
    search_kwargs={"fetch_k": 20, "lambda_mult": 0.5, "k": 5},
)
```
</ex-mmr-search>

<ex-metadata-filtering>
Add metadata to documents and filter search results by metadata properties.
```python
# Add metadata when creating documents
docs = [
    Document(
        page_content="Python programming guide",
        metadata={"language": "python", "topic": "programming"}
    ),
]

# Search with filter
results = vectorstore.similarity_search(
    "programming",
    k=5,
    filter={"language": "python"}  # Only Python docs
)
```
</ex-metadata-filtering>

<ex-rag-with-agent>
Create an agent that uses RAG as a tool for answering questions.
```python
from langchain.agents import create_agent
from langchain.tools import tool

@tool
def search_docs(query: str) -> str:
    """Search documentation for relevant information."""
    docs = retriever.invoke(query)
    return "\n\n".join([d.page_content for d in docs])

agent = create_agent(
    model="gpt-4.1",
    tools=[search_docs],
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "How do I create an agent?"}]
})
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
```python
# WRONG: Too small (loses context) or too large (hits limits)
splitter = RecursiveCharacterTextSplitter(chunk_size=50)
splitter = RecursiveCharacterTextSplitter(chunk_size=10000)

# CORRECT
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
```
</fix-chunk-size>

<fix-chunk-overlap>
Use overlap (10-20% of chunk size) to maintain context at boundaries.
```python
# WRONG: No overlap - context breaks at boundaries
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=0)

# CORRECT: 10-20% overlap
splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
```
</fix-chunk-overlap>

<fix-persist-vectorstore>
Use persistent vector store instead of in-memory to avoid data loss.
```python
# WRONG: InMemory - lost on restart
vectorstore = InMemoryVectorStore.from_documents(docs, embeddings)

# CORRECT
vectorstore = Chroma.from_documents(docs, embeddings, persist_directory="./chroma_db")
```
</fix-persist-vectorstore>

<fix-consistent-embeddings>
Use the same embedding model for indexing and querying.
```python
# WRONG: Different embeddings for index and query - incompatible!
vectorstore = Chroma.from_documents(docs, OpenAIEmbeddings(model="text-embedding-3-small"))
retriever = vectorstore.as_retriever(embeddings=OpenAIEmbeddings(model="text-embedding-3-large"))

# CORRECT: Same model
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
vectorstore = Chroma.from_documents(docs, embeddings)
retriever = vectorstore.as_retriever()  # Uses same embeddings
```
</fix-consistent-embeddings>

<fix-faiss-deserialization>
Explicitly allow deserialization when loading FAISS indexes.
```python
# WRONG: Will raise error
loaded_store = FAISS.load_local("./faiss_index", embeddings)

# CORRECT
loaded_store = FAISS.load_local("./faiss_index", embeddings, allow_dangerous_deserialization=True)
```
</fix-faiss-deserialization>

<fix-dimension-mismatch>
Ensure embedding dimensions match the vector store index dimensions.
```python
# WRONG: Index has 1536 dimensions but using 512-dim embeddings
pc.create_index(name="idx", dimension=1536, metric="cosine")
vectorstore = PineconeVectorStore.from_documents(
    docs, OpenAIEmbeddings(model="text-embedding-3-small", dimensions=512), index=pc.Index("idx")
)  # Error: dimension mismatch!

# CORRECT: Match dimensions
embeddings = OpenAIEmbeddings()  # Default 1536
```
</fix-dimension-mismatch>
