---
name: langgraph-human-in-the-loop
description: "INVOKE THIS SKILL when implementing human-in-the-loop patterns, pausing for approval, or handling errors in LangGraph. Covers interrupt(), Command(resume=...), approval/validation workflows, and the 4-tier error handling strategy."
---

<overview>
LangGraph's human-in-the-loop patterns let you pause graph execution, surface data to users, and resume with their input:

- **`interrupt(value)`** — pauses execution, surfaces a value to the caller
- **`Command(resume=value)`** — resumes execution, providing the value back to `interrupt()`
- **Checkpointer** — required to save state while paused
- **Thread ID** — required to identify which paused execution to resume
</overview>

---

## Requirements

Three things are required for interrupts to work:

1. **Checkpointer** — compile with `checkpointer=InMemorySaver()` (dev) or `PostgresSaver` (prod)
2. **Thread ID** — pass `{"configurable": {"thread_id": "..."}}` to every `invoke`/`stream` call
3. **JSON-serializable payload** — the value passed to `interrupt()` must be JSON-serializable

---

## Basic Interrupt + Resume

`interrupt(value)` pauses the graph. The value surfaces in the result under `__interrupt__`. `Command(resume=value)` resumes — the resume value becomes the return value of `interrupt()`.

**Critical**: when the graph resumes, the node restarts from the **beginning** — all code before `interrupt()` re-runs.

<ex-basic-interrupt-resume>
Pause execution for human review and resume with Command.
```typescript
import { interrupt, Command, MemorySaver, StateGraph, StateSchema, START, END } from "@langchain/langgraph";
import { z } from "zod";

const State = new StateSchema({
  approved: z.boolean().default(false),
});

const approvalNode = async (state: typeof State.State) => {
  // Pause and ask for approval
  const approved = interrupt("Do you approve this action?");
  // When resumed, Command({ resume }) returns that value here
  return { approved };
};

const checkpointer = new MemorySaver();
const graph = new StateGraph(State)
  .addNode("approval", approvalNode)
  .addEdge(START, "approval")
  .addEdge("approval", END)
  .compile({ checkpointer });

const config = { configurable: { thread_id: "thread-1" } };

// Initial run — hits interrupt and pauses
let result = await graph.invoke({ approved: false }, config);
console.log(result.__interrupt__);
// [{ value: 'Do you approve this action?', ... }]

// Resume with the human's response
result = await graph.invoke(new Command({ resume: true }), config);
console.log(result.approved);  // true
```
</ex-basic-interrupt-resume>

---

## Approval Workflow

A common pattern: interrupt to show a draft, then route based on the human's decision.

<ex-approval-workflow>
Interrupt for human review, then route to send or end based on the decision.
```typescript
import { interrupt, Command, END, GraphNode } from "@langchain/langgraph";

const humanReview: GraphNode<typeof EmailAgentState> = async (state) => {
  const classification = state.classification!;

  // interrupt() must come first — any code before it will re-run on resume
  const humanDecision = interrupt({
    emailId: state.emailContent,
    draftResponse: state.responseText,
    urgency: classification.urgency,
    action: "Please review and approve/edit this response",
  });

  // Process the human's decision
  if (humanDecision.approved) {
    return new Command({
      update: { responseText: humanDecision.editedResponse || state.responseText },
      goto: "sendReply",
    });
  } else {
    return new Command({ update: {}, goto: END });
  }
};
```
</ex-approval-workflow>

---

## Validation Loop

Use `interrupt()` in a loop to validate human input and re-prompt if invalid.

<ex-validation-loop>
Validate human input in a loop, re-prompting until valid.
```typescript
import { interrupt } from "@langchain/langgraph";

const getAgeNode = (state: typeof State.State) => {
  let prompt = "What is your age?";

  while (true) {
    const answer = interrupt(prompt);

    // Validate the input
    if (typeof answer === "number" && answer > 0) {
      return { age: answer };
    } else {
      // Invalid input — ask again with a more specific prompt
      prompt = `'${answer}' is not a valid age. Please enter a positive number.`;
    }
  }
};
```
</ex-validation-loop>

---

## Multiple Interrupts

When parallel branches each call `interrupt()`, resume all of them in a single invocation by mapping each interrupt ID to its resume value.

<ex-multiple-interrupts>
Resume multiple parallel interrupts by mapping interrupt IDs to values.
```typescript
import { Command, END, MemorySaver, START, StateGraph, interrupt, isInterrupted, INTERRUPT, Annotation } from "@langchain/langgraph";

const State = Annotation.Root({
  vals: Annotation<string[]>({
    reducer: (left, right) => left.concat(Array.isArray(right) ? right : [right]),
    default: () => [],
  }),
});

function nodeA(_state: typeof State.State) {
  const answer = interrupt("question_a") as string;
  return { vals: [`a:${answer}`] };
}

function nodeB(_state: typeof State.State) {
  const answer = interrupt("question_b") as string;
  return { vals: [`b:${answer}`] };
}

const graph = new StateGraph(State)
  .addNode("a", nodeA)
  .addNode("b", nodeB)
  .addEdge(START, "a")
  .addEdge(START, "b")
  .addEdge("a", END)
  .addEdge("b", END)
  .compile({ checkpointer: new MemorySaver() });

const config = { configurable: { thread_id: "1" } };

const interruptedResult = await graph.invoke({ vals: [] }, config);

// Resume all pending interrupts at once
const resumeMap: Record<string, string> = {};
if (isInterrupted(interruptedResult)) {
  for (const i of interruptedResult[INTERRUPT]) {
    if (i.id != null) {
      resumeMap[i.id] = `answer for ${i.value}`;
    }
  }
}
const result = await graph.invoke(new Command({ resume: resumeMap }), config);
// result.vals = ["a:answer for question_a", "b:answer for question_b"]
```
</ex-multiple-interrupts>

User-fixable errors use `interrupt()` to pause and collect missing data — that's the pattern covered by this skill. For the full 4-tier error handling strategy (RetryPolicy, Command error loops, etc.), see the **fundamentals** skill.

---

## Side Effects Before Interrupt Must Be Idempotent

When the graph resumes, the node restarts from the **beginning** — ALL code before `interrupt()` re-runs. In subgraphs, BOTH the parent node and the subgraph node re-execute.

<idempotency-rules>

**Do:**
- Use **upsert** (not insert) operations before `interrupt()`
- Use **check-before-create** patterns
- Place side effects **after** `interrupt()` when possible
- Separate side effects into their own nodes

**Don't:**
- Create new records before `interrupt()` — duplicates on each resume
- Append to lists before `interrupt()` — duplicate entries on each resume

</idempotency-rules>

<ex-idempotent-patterns>
Idempotent operations before interrupt vs non-idempotent (wrong).
```typescript
// GOOD: Upsert is idempotent — safe before interrupt
const nodeA = async (state: typeof State.State) => {
  await db.upsertUser({ userId: state.userId, status: "pending_approval" });
  const approved = interrupt("Approve this change?");
  return { approved };
};

// GOOD: Side effect AFTER interrupt — only runs once
const nodeA = async (state: typeof State.State) => {
  const approved = interrupt("Approve this change?");
  if (approved) {
    await db.createAuditLog({ userId: state.userId, action: "approved" });
  }
  return { approved };
};

// BAD: Insert creates duplicates on each resume!
const nodeA = async (state: typeof State.State) => {
  await db.createAuditLog({  // Runs again on resume!
    userId: state.userId,
    action: "pending_approval",
  });
  const approved = interrupt("Approve this change?");
  return { approved };
};
```
</ex-idempotent-patterns>

<subgraph-interrupt-re-execution>

### Subgraph re-execution on resume

When a subgraph contains an `interrupt()`, resuming re-executes BOTH the parent node (that invoked the subgraph) AND the subgraph node (that called `interrupt()`):

```typescript
async function nodeInParentGraph(state: State) {
  someCode();  // <-- Re-executes on resume
  const subgraphResult = await subgraph.invoke(someInput);
  // ...
}

async function nodeInSubgraph(state: State) {
  someOtherCode();  // <-- Also re-executes on resume
  const result = interrupt("What's your name?");
  // ...
}
```
</subgraph-interrupt-re-execution>

---

## Command(resume) Warning

`Command(resume=...)` is the **only** Command pattern intended as input to `invoke()`/`stream()`. Do NOT pass `Command(update=...)` as input — it resumes from the latest checkpoint and the graph appears stuck. See the fundamentals skill for the full antipattern explanation.

---

## Fixes

<fix-checkpointer-required-for-interrupts>
Checkpointer required for interrupt functionality.
```typescript
// WRONG
const graph = builder.compile();

// CORRECT
const graph = builder.compile({ checkpointer: new MemorySaver() });
```
</fix-checkpointer-required-for-interrupts>

<fix-resume-with-command>
Use Command to resume from an interrupt (regular object restarts graph).
```typescript
// WRONG
await graph.invoke({ resumeData: "approve" }, config);

// CORRECT
await graph.invoke(new Command({ resume: "approve" }), config);
```
</fix-resume-with-command>

<boundaries>
### What You Should NOT Do

- Use interrupts without a checkpointer — will fail
- Resume without the same thread_id — creates a new thread instead of resuming
- Pass `Command(update=...)` as invoke input — graph appears stuck (use plain dict)
- Perform non-idempotent side effects before `interrupt()` — creates duplicates on resume
- Assume code before `interrupt()` only runs once — it re-runs every resume
</boundaries>
