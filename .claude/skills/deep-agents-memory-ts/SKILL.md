---
name: deep-agents-memory-ts
description: "INVOKE THIS SKILL when your Deep Agent needs memory, persistence, or filesystem access. Covers StateBackend (ephemeral), StoreBackend (persistent), FilesystemMiddleware, and CompositeBackend for routing."
---

<overview>
Deep Agents use pluggable backends for file operations and memory:

**Short-term (StateBackend)**: Persists within a single thread, lost when thread ends
**Long-term (StoreBackend)**: Persists across threads and sessions
**Hybrid (CompositeBackend)**: Route different paths to different backends

FilesystemMiddleware provides tools: `ls`, `read_file`, `write_file`, `edit_file`, `glob`, `grep`
</overview>

<backend-selection>

| Use Case | Backend | Why |
|----------|---------|-----|
| Temporary working files | StateBackend | Default, no setup |
| Local development CLI | FilesystemBackend | Direct disk access |
| Cross-session memory | StoreBackend | Persists across threads |
| Hybrid storage | CompositeBackend | Mix ephemeral + persistent |

</backend-selection>

<ex-default-state-backend>
Default StateBackend stores files ephemerally within a thread.
```typescript
import { createDeepAgent } from "deepagents";

const agent = await createDeepAgent();  // Default: StateBackend
const result = await agent.invoke({
  messages: [{ role: "user", content: "Write notes to /draft.txt" }]
}, { configurable: { thread_id: "thread-1" } });
// /draft.txt is lost when thread ends
```
</ex-default-state-backend>

<ex-composite-backend-for-hybrid>
Configure CompositeBackend to route paths to different storage backends.
```typescript
import { createDeepAgent, CompositeBackend, StateBackend, StoreBackend } from "deepagents";
import { InMemoryStore } from "@langchain/langgraph";

const store = new InMemoryStore();

const agent = await createDeepAgent({
  backend: (config) => new CompositeBackend(
    new StateBackend(config),
    { "/memories/": new StoreBackend(config) }
  ),
  store
});

// /draft.txt -> ephemeral (StateBackend)
// /memories/user-prefs.txt -> persistent (StoreBackend)
```
</ex-composite-backend-for-hybrid>

<ex-cross-session-memory>
Files in /memories/ persist across threads via StoreBackend routing.
```typescript
// Using CompositeBackend from previous example
const config1 = { configurable: { thread_id: "thread-1" } };
await agent.invoke({ messages: [{ role: "user", content: "Save to /memories/style.txt" }] }, config1);

const config2 = { configurable: { thread_id: "thread-2" } };
await agent.invoke({ messages: [{ role: "user", content: "Read /memories/style.txt" }] }, config2);
// Thread 2 can read file saved by Thread 1
```
</ex-cross-session-memory>

<ex-filesystem-backend-local-dev>
Use FilesystemBackend for local development with real disk access and human-in-the-loop.
```typescript
import { createDeepAgent, FilesystemBackend } from "deepagents";
import { MemorySaver } from "@langchain/langgraph";

const agent = await createDeepAgent({
  backend: new FilesystemBackend({ rootDir: ".", virtualMode: true }),
  interruptOn: { write_file: true, edit_file: true },
  checkpointer: new MemorySaver()
});
```

**Security: Never use FilesystemBackend in web servers - use StateBackend or sandbox instead.**
</ex-filesystem-backend-local-dev>

<ex-store-in-custom-tools>
</ex-store-in-custom-tools>

<boundaries>
### What Agents CAN Configure

- Backend type and configuration
- Routing rules for CompositeBackend
- Root directory for FilesystemBackend
- Human-in-the-loop for file operations

### What Agents CANNOT Configure

- Tool names (ls, read_file, write_file, edit_file, glob, grep)
- Access files outside virtual_mode restrictions
- Cross-thread file access without proper backend setup
</boundaries>

<fix-storebackend-requires-store>
StoreBackend requires a store instance.
```typescript
// WRONG
const agent = await createDeepAgent({ backend: (c) => new StoreBackend(c) });

// CORRECT
const agent = await createDeepAgent({ backend: (c) => new StoreBackend(c), store: new InMemoryStore() });
```
</fix-storebackend-requires-store>

<fix-statebackend-files-dont-persist>
StateBackend files are thread-scoped - use same thread_id or StoreBackend for cross-thread access.
```typescript
// WRONG: thread-2 can't read file from thread-1
await agent.invoke({ messages: [...] }, { configurable: { thread_id: "thread-1" } });  // Write
await agent.invoke({ messages: [...] }, { configurable: { thread_id: "thread-2" } });  // File not found!
```
</fix-statebackend-files-dont-persist>

<fix-path-prefix-for-persistence>
Path must match CompositeBackend route prefix for persistence.
```typescript
// With routes: { "/memories/": StoreBackend }:
await agent.invoke(...);  // /prefs.txt -> ephemeral (no match)
await agent.invoke(...);  // /memories/prefs.txt -> persistent (matches route)
```
</fix-path-prefix-for-persistence>

<fix-production-store>
Use PostgresStore for production (InMemoryStore lost on restart).
```typescript
// WRONG                                    // CORRECT
const store = new InMemoryStore();          const store = new PostgresStore({ connectionString: "..." });
```
</fix-production-store>

<fix-filesystem-backend-needs-virtual-mode>
</fix-filesystem-backend-needs-virtual-mode>

<fix-longest-prefix-match>
</fix-longest-prefix-match>
