---
name: langgraph-persistence-ts
description: "INVOKE THIS SKILL when your LangGraph needs to persist state, remember conversations, travel through history, or configure subgraph checkpointer scoping. Covers checkpointers, thread_id, time travel, Store, and subgraph persistence modes."
---

<overview>
LangGraph's persistence layer enables durable execution by checkpointing graph state:

- **Checkpointer**: Saves/loads graph state at every super-step
- **Thread ID**: Identifies separate checkpoint sequences (conversations)
- **Store**: Cross-thread memory for user preferences, facts

**Two memory types:**
- **Short-term** (checkpointer): Thread-scoped conversation history
- **Long-term** (store): Cross-thread user preferences, facts
</overview>

<checkpointer-selection>

| Checkpointer | Use Case | Production Ready |
|--------------|----------|------------------|
| `InMemorySaver` | Testing, development | No |
| `SqliteSaver` | Local development | Partial |
| `PostgresSaver` | Production | Yes |

</checkpointer-selection>

---

## Checkpointer Setup

<ex-basic-persistence>
Set up a basic graph with in-memory checkpointing and thread-based state persistence.
```typescript
import { MemorySaver, StateGraph, StateSchema, MessagesValue, START, END } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

const State = new StateSchema({ messages: MessagesValue });

const addMessage = async (state: typeof State.State) => {
  return { messages: [{ role: "assistant", content: "Bot response" }] };
};

const checkpointer = new MemorySaver();

const graph = new StateGraph(State)
  .addNode("respond", addMessage)
  .addEdge(START, "respond")
  .addEdge("respond", END)
  .compile({ checkpointer });

// ALWAYS provide thread_id
const config = { configurable: { thread_id: "conversation-1" } };

const result1 = await graph.invoke({ messages: [new HumanMessage("Hello")] }, config);
console.log(result1.messages.length);  // 2

const result2 = await graph.invoke({ messages: [new HumanMessage("How are you?")] }, config);
console.log(result2.messages.length);  // 4 (previous + new)
```
</ex-basic-persistence>

<ex-production-postgres>
Configure PostgreSQL-backed checkpointing for production deployments.
```typescript
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

const checkpointer = PostgresSaver.fromConnString(
  "postgresql://user:pass@localhost/db"
);
await checkpointer.setup(); // only needed on first use to create tables

const graph = builder.compile({ checkpointer });
```
</ex-production-postgres>

---

## Thread Management

<ex-separate-threads>
Demonstrate isolated state between different thread IDs.
```typescript
// Different threads maintain separate state
const aliceConfig = { configurable: { thread_id: "user-alice" } };
const bobConfig = { configurable: { thread_id: "user-bob" } };

await graph.invoke({ messages: [new HumanMessage("Hi from Alice")] }, aliceConfig);
await graph.invoke({ messages: [new HumanMessage("Hi from Bob")] }, bobConfig);

// Alice's state is isolated from Bob's
```
</ex-separate-threads>

---

## State History & Time Travel

<ex-resume-from-checkpoint>
Time travel: browse checkpoint history and replay or fork from a past state.
```typescript
const config = { configurable: { thread_id: "session-1" } };

const result = await graph.invoke({ messages: ["start"] }, config);

// Browse checkpoint history (async iterable, collect to array)
const states: Awaited<ReturnType<typeof graph.getState>>[] = [];
for await (const state of graph.getStateHistory(config)) {
  states.push(state);
}

// Replay from a past checkpoint
const past = states[states.length - 2];
const replayed = await graph.invoke(null, past.config);  // null = resume from checkpoint

// Or fork: update state at a past checkpoint, then resume
const forkConfig = await graph.updateState(past.config, { messages: ["edited"] });
const forked = await graph.invoke(null, forkConfig);
```
</ex-resume-from-checkpoint>

<ex-update-state>
Manually update graph state before resuming execution.
```typescript
const config = { configurable: { thread_id: "session-1" } };

// Modify state before resuming
await graph.updateState(config, { data: "manually_updated" });

// Resume with updated state
const result = await graph.invoke(null, config);
```
</ex-update-state>

---

## Subgraph Checkpointer Scoping

When compiling a subgraph, the `checkpointer` parameter controls persistence behavior. This is critical for subgraphs that use interrupts, need multi-turn memory, or run in parallel.

<subgraph-checkpointer-scoping-table>

| Feature | `checkpointer=False` | `None` (default) | `True` |
|---|---|---|---|
| Interrupts (HITL) | No | Yes | Yes |
| Multi-turn memory | No | No | Yes |
| Multiple calls (different subgraphs) | Yes | Yes | Warning (namespace conflicts possible) |
| Multiple calls (same subgraph) | Yes | Yes | No |
| State inspection | No | Warning (current invocation only) | Yes |

</subgraph-checkpointer-scoping-table>

<subgraph-checkpointer-when-to-use>

### When to use each mode

- **`checkpointer=False`** — Subgraph doesn't need interrupts or persistence. Simplest option, no checkpoint overhead.
- **`None` (default / omit `checkpointer`)** — Subgraph needs `interrupt()` but not multi-turn memory. Each invocation starts fresh but can pause/resume. Parallel execution works because each invocation gets a unique namespace.
- **`checkpointer=True`** — Subgraph needs to remember state across invocations (multi-turn conversations). Each call picks up where the last left off.

</subgraph-checkpointer-when-to-use>

<warning-stateful-subgraphs-parallel>

**Warning**: Stateful subgraphs (`checkpointer=True`) do NOT support calling the same subgraph instance multiple times within a single node — the calls write to the same checkpoint namespace and conflict.

</warning-stateful-subgraphs-parallel>

<ex-subgraph-checkpointer-modes>
Choose the right checkpointer mode for your subgraph.
```typescript
// No interrupts needed — opt out of checkpointing
const subgraph = subgraphBuilder.compile({ checkpointer: false });

// Need interrupts but not cross-invocation persistence (default)
const subgraph = subgraphBuilder.compile();

// Need cross-invocation persistence (stateful)
const subgraph = subgraphBuilder.compile({ checkpointer: true });
```
</ex-subgraph-checkpointer-modes>

<parallel-subgraph-namespacing>

### Parallel subgraph namespacing

When multiple **different** stateful subgraphs run in parallel, wrap each in its own `StateGraph` with a unique node name for stable namespace isolation:

```typescript
import { StateGraph, StateSchema, MessagesValue, START } from "@langchain/langgraph";

function createSubAgent(model: string, { name, ...kwargs }: { name: string; [key: string]: any }) {
  const agent = createAgent({ model, name, ...kwargs });
  return new StateGraph(new StateSchema({ messages: MessagesValue }))
    .addNode(name, agent)  // unique name -> stable namespace
    .addEdge(START, name)
    .compile();
}

const fruitAgent = createSubAgent("gpt-4.1-mini", {
  name: "fruit_agent", tools: [fruitInfo], prompt: "...", checkpointer: true,
});
const veggieAgent = createSubAgent("gpt-4.1-mini", {
  name: "veggie_agent", tools: [veggieInfo], prompt: "...", checkpointer: true,
});
```

Note: Subgraphs added as nodes (via `add_node`) already get name-based namespaces automatically and don't need this wrapper.

</parallel-subgraph-namespacing>

---

## Long-Term Memory (Store)

<ex-long-term-memory-store>
Use a Store for cross-thread memory to share user preferences across conversations.
```typescript
import { MemoryStore } from "@langchain/langgraph";

const store = new MemoryStore();

// Save user preference (available across ALL threads)
await store.put(["alice", "preferences"], "language", { preference: "short responses" });

// Node with store — access via runtime
const respond = async (state: typeof State.State, runtime: any) => {
  const item = await runtime.store?.get(["alice", "preferences"], "language");
  return { response: `Using preference: ${item?.value?.preference}` };
};

// Compile with BOTH checkpointer and store
const graph = builder.compile({ checkpointer, store });

// Both threads access same long-term memory
await graph.invoke({ userId: "alice" }, { configurable: { thread_id: "thread-1" } });
await graph.invoke({ userId: "alice" }, { configurable: { thread_id: "thread-2" } });  // Same preferences!
```
</ex-long-term-memory-store>

<ex-store-operations>
</ex-store-operations>

---

## Fixes

<fix-thread-id-required>
Always provide thread_id in config to enable state persistence.
```typescript
// WRONG: No thread_id - state NOT persisted!
await graph.invoke({ messages: [new HumanMessage("Hello")] });
await graph.invoke({ messages: [new HumanMessage("What did I say?")] });  // Doesn't remember!

// CORRECT: Always provide thread_id
const config = { configurable: { thread_id: "session-1" } };
await graph.invoke({ messages: [new HumanMessage("Hello")] }, config);
await graph.invoke({ messages: [new HumanMessage("What did I say?")] }, config);  // Remembers!
```
</fix-thread-id-required>

<fix-inmemory-not-for-production>
Use PostgresSaver instead of MemorySaver for production persistence.
```typescript
// WRONG: Data lost on process restart
const checkpointer = new MemorySaver();  // In-memory only!

// CORRECT: Use persistent storage for production
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
const checkpointer = PostgresSaver.fromConnString("postgresql://...");
await checkpointer.setup(); // only needed on first use to create tables
```
</fix-inmemory-not-for-production>

<fix-update-state-with-reducers>
Use Overwrite to replace state values instead of passing through reducers.
```typescript
import { Overwrite } from "@langchain/langgraph";

// State with reducer: items uses concat reducer
// Current state: { items: ["A", "B"] }

// updateState PASSES THROUGH reducers
await graph.updateState(config, { items: ["C"] });  // Result: ["A", "B", "C"] - Appended!

// To REPLACE instead, use Overwrite
await graph.updateState(config, { items: new Overwrite(["C"]) });  // Result: ["C"] - Replaced
```
</fix-update-state-with-reducers>

<fix-store-injection>
Access store via runtime parameter in graph nodes.
```typescript
// WRONG: Store not available in node
const myNode = async (state) => {
  store.put(...);  // ReferenceError!
};

// CORRECT: Access store via runtime
const myNode = async (state, runtime) => {
  await runtime.store?.put(...);  // Correct store instance
};
```
</fix-store-injection>

<boundaries>
### What You Should NOT Do

- Use `InMemorySaver` in production — data lost on restart; use `PostgresSaver`
- Forget `thread_id` — state won't persist without it
- Expect `update_state` to bypass reducers — it passes through them; use `Overwrite` to replace
- Run the same stateful subgraph (`checkpointer=True`) in parallel within one node — namespace conflict
- Access store directly in a node — use `runtime.store` via the `Runtime` param
</boundaries>
