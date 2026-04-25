---
name: langchain-middleware
description: "INVOKE THIS SKILL when you need human-in-the-loop approval, custom middleware, or structured output. Covers HumanInTheLoopMiddleware for human approval of dangerous tool calls, creating custom middleware with hooks, Command resume patterns, and structured output with Pydantic/Zod."
---

<overview>
Middleware patterns for production LangChain agents:

- **HumanInTheLoopMiddleware** / **humanInTheLoopMiddleware**: Pause before dangerous tool calls for human approval
- **Custom middleware**: Intercept tool calls for error handling, logging, retry logic
- **Command resume**: Continue execution after human decisions (approve, edit, reject)

**Requirements:** Checkpointer + thread_id config for all HITL workflows.
</overview>

---

## Human-in-the-Loop

<ex-basic-hitl-setup>
Set up an agent with HITL that pauses before sending emails for human approval.
```typescript
import { createAgent, humanInTheLoopMiddleware } from "langchain";
import { MemorySaver } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const sendEmail = tool(
  async ({ to, subject, body }) => `Email sent to ${to}`,
  {
    name: "send_email",
    description: "Send an email",
    schema: z.object({ to: z.string(), subject: z.string(), body: z.string() }),
  }
);

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5",
  tools: [sendEmail],
  checkpointer: new MemorySaver(),
  middleware: [
    humanInTheLoopMiddleware({
      interruptOn: { send_email: { allowedDecisions: ["approve", "edit", "reject"] } },
    }),
  ],
});
```
</ex-basic-hitl-setup>

<ex-running-with-interrupts>
Run the agent, detect an interrupt, then resume execution after human approval.
```typescript
import { Command } from "@langchain/langgraph";

const config = { configurable: { thread_id: "session-1" } };

// Step 1: Agent runs until it needs to call tool
const result1 = await agent.invoke({
  messages: [{ role: "user", content: "Send email to john@example.com" }]
}, config);

// Check for interrupt
if (result1.__interrupt__) {
  console.log(`Waiting for approval: ${result1.__interrupt__}`);
}

// Step 2: Human approves
const result2 = await agent.invoke(
  new Command({ resume: { decisions: [{ type: "approve" }] } }),
  config
);
```
</ex-running-with-interrupts>

<ex-editing-tool-arguments>
Edit the tool arguments before approving when the original values need correction.
```typescript
// Human edits the arguments — editedAction must include name + args
const result2 = await agent.invoke(
  new Command({
    resume: {
      decisions: [{
        type: "edit",
        editedAction: {
          name: "send_email",
          args: {
            to: "alice@company.com",  // Fixed email
            subject: "Project Meeting - Updated",
            body: "...",
          },
        },
      }]
    }
  }),
  config
);
```
</ex-editing-tool-arguments>

<ex-rejecting-with-feedback>
</ex-rejecting-with-feedback>

<ex-multiple-tools-different-policies>
</ex-multiple-tools-different-policies>

<boundaries>
### What You CAN Configure

- Which tools require approval (per-tool policies)
- Allowed decisions per tool (approve, edit, reject)
- Custom middleware hooks: `before_model`, `after_model`, `wrap_tool_call`, `before_agent`, `after_agent`
- Tool-specific middleware (apply only to certain tools)
</boundaries>

---

## Custom Middleware Hooks

Six decorator hooks are available. Two patterns:

- **Wrap hooks** (`wrap_tool_call`, `wrap_model_call`): `(request, handler)` — call `handler(request)` to proceed, or return early to short-circuit.
- **Before/after hooks** (`before_model`, `after_model`, `before_agent`, `after_agent`): `(state, runtime)` — inspect or modify state. Return `None` or a dict of state updates.

<ex-wrap-tool-call>
`createMiddleware({ wrapToolCall })` intercepts tool execution.

```typescript
import { createMiddleware } from "langchain";

const retryMiddleware = createMiddleware({
  wrapToolCall: async (request, handler) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try { return await handler(request); }
      catch (e) { if (attempt === 2) throw e; }
    }
  },
});
```
</ex-wrap-tool-call>

<ex-before-after-hooks>
All before/after hooks share the same `(state, runtime)` signature via `createMiddleware`.

```typescript
import { createMiddleware } from "langchain";

const loggingMiddleware = createMiddleware({
  beforeModel: (state, runtime) => {
    console.log(`Calling model with ${state.messages.length} messages`);
  },
  afterModel: (state, runtime) => {
    console.log("Model responded");
  },
});
```
</ex-before-after-hooks>

<boundaries>
### What You CANNOT Configure

- Interrupt after tool execution (must be before)
- Skip checkpointer requirement for HITL
</boundaries>

<fix-missing-checkpointer>
HITL requires a checkpointer to persist state.
```typescript
// WRONG: No checkpointer
const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5", tools: [sendEmail],
  middleware: [humanInTheLoopMiddleware({ interruptOn: { send_email: true } })],
});

// CORRECT: Add checkpointer
const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5", tools: [sendEmail],
  checkpointer: new MemorySaver(),
  middleware: [humanInTheLoopMiddleware({ interruptOn: { send_email: true } })],
});
```
</fix-missing-checkpointer>

<fix-no-thread-id>
</fix-no-thread-id>

<fix-wrong-resume-syntax>
Use Command class to resume execution after an interrupt.
```typescript
// WRONG
await agent.invoke({ resume: { decisions: [...] } });

// CORRECT
import { Command } from "@langchain/langgraph";
await agent.invoke(new Command({ resume: { decisions: [{ type: "approve" }] } }), config);
```
</fix-wrong-resume-syntax>
