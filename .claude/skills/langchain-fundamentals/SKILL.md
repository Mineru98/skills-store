---
name: langchain-fundamentals
description: Create LangChain agents with create_agent, define tools, and use middleware for human-in-the-loop and error handling.
---

<oneliner>
Build production agents using `create_agent()`, middleware patterns, and the `@tool` decorator / `tool()` function. When creating LangChain agents, you MUST use create_agent(), with middleware for custom flows. All other alternatives are outdated.
</oneliner>

<create_agent>
## Creating Agents with create_agent

`create_agent()` is the recommended way to build agents. It handles the agent loop, tool execution, and state management.

### Agent Configuration Options

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `model` | LLM to use | `"anthropic:claude-sonnet-4-5"` or model instance |
| `tools` | List of tools | `[search, calculator]` |
| `system_prompt` / `systemPrompt` | Agent instructions | `"You are a helpful assistant"` |
| `checkpointer` | State persistence | `MemorySaver()` |
| `middleware` | Processing hooks | `[HumanInTheLoopMiddleware]` (Python) / `[humanInTheLoopMiddleware({...})]` (TypeScript) |
</create_agent>

<ex-basic-agent>
```typescript
import { createAgent } from "langchain";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const getWeather = tool(
  async ({ location }) => `Weather in ${location}: Sunny, 72F`,
  {
    name: "get_weather",
    description: "Get current weather for a location.",
    schema: z.object({ location: z.string().describe("City name") }),
  }
);

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5",
  tools: [getWeather],
  systemPrompt: "You are a helpful assistant.",
});

const result = await agent.invoke({
  messages: [{ role: "user", content: "What's the weather in Paris?" }],
});
console.log(result.messages[result.messages.length - 1].content);
```
</ex-basic-agent>

<ex-agent-with-persistence>
Add MemorySaver checkpointer to maintain conversation state across invocations.
```typescript
import { createAgent } from "langchain";
import { MemorySaver } from "@langchain/langgraph";

const checkpointer = new MemorySaver();

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5",
  tools: [search],
  checkpointer,
});

const config = { configurable: { thread_id: "user-123" } };
await agent.invoke({ messages: [{ role: "user", content: "My name is Alice" }] }, config);
const result = await agent.invoke({ messages: [{ role: "user", content: "What's my name?" }] }, config);
// Agent remembers: "Your name is Alice"
```
</ex-agent-with-persistence>

<tools>
## Defining Tools

Tools are functions that agents can call. Use the `@tool` decorator (Python) or `tool()` function (TypeScript).
</tools>

<ex-basic-tool>
```typescript
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const add = tool(
  async ({ a, b }) => a + b,
  {
    name: "add",
    description: "Add two numbers.",
    schema: z.object({
      a: z.number().describe("First number"),
      b: z.number().describe("Second number"),
    }),
  }
);
```
</ex-basic-tool>

<middleware>
## Middleware for Agent Control

Middleware intercepts the agent loop to add human approval, error handling, logging, and more. A deep understanding of middleware is essential for production agents — use `HumanInTheLoopMiddleware` (Python) / `humanInTheLoopMiddleware` (TypeScript) for approval workflows, and `@wrap_tool_call` (Python) / `createMiddleware` (TypeScript) for custom hooks.

Key imports:
```python
from langchain.agents.middleware import HumanInTheLoopMiddleware, wrap_tool_call
```
```typescript
import { humanInTheLoopMiddleware, createMiddleware } from "langchain";
```

Key patterns:
- **HITL**: `middleware=[HumanInTheLoopMiddleware(interrupt_on={"dangerous_tool": True})]` — requires `checkpointer` + `thread_id`
- **Resume after interrupt**: `agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), config=config)`
- **Custom middleware**: `@wrap_tool_call` decorator (Python) or `createMiddleware({ wrapToolCall: ... })` (TypeScript)
</middleware>

<structured_output>
## Structured Output

Get typed, validated responses from agents using `response_format` or `with_structured_output()`.

```typescript
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";

const ContactInfo = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().describe("Phone number with area code"),
});

// Model-level structured output
const model = new ChatOpenAI({ model: "gpt-4.1" });
const structuredModel = model.withStructuredOutput(ContactInfo);
const response = await structuredModel.invoke("Extract: John, john@example.com, 555-1234");
// { name: 'John', email: 'john@example.com', phone: '555-1234' }
```
</structured_output>

<model_config>
## Model Configuration

`create_agent` accepts model strings (`"anthropic:claude-sonnet-4-5"`, `"openai:gpt-4.1"`) or model instances for custom settings:

```python
from langchain_anthropic import ChatAnthropic
agent = create_agent(model=ChatAnthropic(model="claude-sonnet-4-5", temperature=0), tools=[...])
```
</model_config>

<fix-missing-tool-description>
Clear descriptions help the agent know when to use each tool.
```typescript
// WRONG: Vague description
const badTool = tool(async ({ input }) => "result", {
  name: "bad_tool",
  description: "Does stuff.", // Too vague!
  schema: z.object({ input: z.string() }),
});

// CORRECT: Clear, specific description
const search = tool(async ({ query }) => webSearch(query), {
  name: "search",
  description: "Search the web for current information about a topic. Use this when you need recent data or facts.",
  schema: z.object({
    query: z.string().describe("The search query (2-10 words recommended)"),
  }),
});
```
</fix-missing-tool-description>

<fix-no-checkpointer>
Add checkpointer and thread_id for conversation memory across invocations.
```typescript
// WRONG: No persistence
const agent = createAgent({ model: "anthropic:claude-sonnet-4-5", tools: [search] });
await agent.invoke({ messages: [{ role: "user", content: "I'm Bob" }] });
await agent.invoke({ messages: [{ role: "user", content: "What's my name?" }] });
// Agent doesn't remember!

// CORRECT: Add checkpointer and thread_id
import { MemorySaver } from "@langchain/langgraph";

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-5",
  tools: [search],
  checkpointer: new MemorySaver(),
});
const config = { configurable: { thread_id: "session-1" } };
await agent.invoke({ messages: [{ role: "user", content: "I'm Bob" }] }, config);
await agent.invoke({ messages: [{ role: "user", content: "What's my name?" }] }, config);
// Agent remembers: "Your name is Bob"
```
</fix-no-checkpointer>

<fix-infinite-loop>
Set recursionLimit in the invoke config to prevent runaway agent loops.
```typescript
// WRONG: No iteration limit
const result = await agent.invoke({ messages: [["user", "Do research"]] });

// CORRECT: Set recursionLimit in config
const result = await agent.invoke(
  { messages: [["user", "Do research"]] },
  { recursionLimit: 10 }, // Stop after 10 steps
);
```
</fix-infinite-loop>

<fix-accessing-result-wrong>
Access the messages array from the result, not result.content directly.
```typescript
// WRONG: Trying to access result.content directly
const result = await agent.invoke({ messages: [{ role: "user", content: "Hello" }] });
console.log(result.content); // undefined!

// CORRECT: Access messages from result object
const result = await agent.invoke({ messages: [{ role: "user", content: "Hello" }] });
console.log(result.messages[result.messages.length - 1].content); // Last message content
```
</fix-accessing-result-wrong>
