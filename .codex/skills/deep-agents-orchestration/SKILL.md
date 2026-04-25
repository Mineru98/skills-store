---
name: deep-agents-orchestration-py
description: "INVOKE THIS SKILL when using subagents, task planning, or human approval in Deep Agents. Covers SubAgentMiddleware, TodoList for planning, and HITL interrupts."
---

<overview>
Deep Agents include three orchestration capabilities:

1. **SubAgentMiddleware**: Delegate work via `task` tool to specialized agents
2. **TodoListMiddleware**: Plan and track tasks via `write_todos` tool
3. **HumanInTheLoopMiddleware**: Require approval before sensitive operations

All three are automatically included in `create_deep_agent()`.
</overview>

---

## Subagents (Task Delegation)

<when-to-use-subagents>

| Use Subagents When | Use Main Agent When |
|-------------------|-------------------|
| Task needs specialized tools | General-purpose tools sufficient |
| Want to isolate complex work | Single-step operation |
| Need clean context for main agent | Context bloat acceptable |

</when-to-use-subagents>

<how-subagents-work>
Main agent has `task` tool -> creates fresh subagent -> subagent executes autonomously -> returns final report.

**Default subagent**: "general-purpose" - automatically available with same tools/config as main agent.
</how-subagents-work>

<ex-custom-subagents>
Create a custom "researcher" subagent with specialized tools for academic paper search.
```python
from deepagents import create_deep_agent
from langchain.tools import tool

@tool
def search_papers(query: str) -> str:
    """Search academic papers."""
    return f"Found 10 papers about {query}"

agent = create_deep_agent(
    subagents=[
        {
            "name": "researcher",
            "description": "Conduct web research and compile findings",
            "system_prompt": "Search thoroughly, return concise summary",
            "tools": [search_papers],
        }
    ]
)

# Main agent delegates: task(agent="researcher", instruction="Research AI trends")
```
</ex-custom-subagents>

<ex-subagent-with-hitl>
Configure a subagent with HITL approval for sensitive operations.
```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

agent = create_deep_agent(
    subagents=[
        {
            "name": "code-deployer",
            "description": "Deploy code to production",
            "system_prompt": "You deploy code after tests pass.",
            "tools": [run_tests, deploy_to_prod],
            "interrupt_on": {"deploy_to_prod": True},  # Require approval
        }
    ],
    checkpointer=MemorySaver()  # Required for interrupts
)
```
</ex-subagent-with-hitl>

<fix-subagents-are-stateless>
Subagents are stateless - provide complete instructions in a single call.
```python
# WRONG: Subagents don't remember previous calls
# task(agent='research', instruction='Find data')
# task(agent='research', instruction='What did you find?')  # Starts fresh!

# CORRECT: Complete instructions upfront
# task(agent='research', instruction='Find data on AI, save to /research/, return summary')
```
</fix-subagents-are-stateless>

<fix-custom-subagents-dont-inherit-skills>
Custom subagents don't inherit skills from the main agent.
```python
# WRONG: Custom subagent won't have main agent's skills
agent = create_deep_agent(
    skills=["/main-skills/"],
    subagents=[{"name": "helper", ...}]  # No skills inherited
)

# CORRECT: Provide skills explicitly (general-purpose subagent DOES inherit)
agent = create_deep_agent(
    skills=["/main-skills/"],
    subagents=[{"name": "helper", "skills": ["/helper-skills/"], ...}]
)
```
</fix-custom-subagents-dont-inherit-skills>

---

## TodoList (Task Planning)

<when-to-use-todolist>

| Use TodoList When | Skip TodoList When |
|------------------|-------------------|
| Complex multi-step tasks | Simple single-action tasks |
| Long-running operations | Quick operations (< 3 steps) |

</when-to-use-todolist>

<todolist-tool>
```
write_todos(todos: list[dict]) -> None
```

Each todo item has:
- `content`: Description of the task
- `status`: One of `"pending"`, `"in_progress"`, `"completed"`
</todolist-tool>

<ex-todolist-usage>
Invoke an agent that automatically creates a todo list for a multi-step task.
```python
from deepagents import create_deep_agent

agent = create_deep_agent()  # TodoListMiddleware included by default

result = agent.invoke({
    "messages": [{"role": "user", "content": "Create a REST API: design models, implement CRUD, add auth, write tests"}]
}, config={"configurable": {"thread_id": "session-1"}})

# Agent's planning via write_todos:
# [
#   {"content": "Design data models", "status": "in_progress"},
#   {"content": "Implement CRUD endpoints", "status": "pending"},
#   {"content": "Add authentication", "status": "pending"},
#   {"content": "Write tests", "status": "pending"}
# ]
```
</ex-todolist-usage>

<ex-access-todo-state>
Access the todo list from the agent's final state after invocation.
```python
result = agent.invoke({...}, config={"configurable": {"thread_id": "session-1"}})

# Access todo list from final state
todos = result.get("todos", [])
for todo in todos:
    print(f"[{todo['status']}] {todo['content']}")
```
</ex-access-todo-state>

<fix-todolist-requires-thread-id>
Todo list state requires a thread_id for persistence across invocations.
```python
# WRONG: Fresh state each time without thread_id
agent.invoke({"messages": [...]})

# CORRECT: Use thread_id
config = {"configurable": {"thread_id": "user-session"}}
agent.invoke({"messages": [...]}, config=config)  # Todos preserved
```
</fix-todolist-requires-thread-id>

---

## Human-in-the-Loop (Approval Workflows)

<when-to-use-hitl>

| Use HITL When | Skip HITL When |
|--------------|---------------|
| High-stakes operations (DB writes, deployments) | Read-only operations |
| Compliance requires human oversight | Fully automated workflows |

</when-to-use-hitl>

<ex-hitl-setup>
Configure which tools require human approval before execution.
```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver

agent = create_deep_agent(
    interrupt_on={
        "write_file": True,  # All decisions allowed
        "execute_sql": {"allowed_decisions": ["approve", "reject"]},
        "read_file": False,  # No interrupts
    },
    checkpointer=MemorySaver()  # REQUIRED for interrupts
)
```
</ex-hitl-setup>

<ex-approval-workflow>
Complete workflow: trigger an interrupt, check state, approve action, and resume execution.
```python
from deepagents import create_deep_agent
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import Command

agent = create_deep_agent(
    interrupt_on={"write_file": True},
    checkpointer=MemorySaver()
)

config = {"configurable": {"thread_id": "session-1"}}

# Step 1: Agent proposes write_file - execution pauses
result = agent.invoke({
    "messages": [{"role": "user", "content": "Write config to /prod.yaml"}]
}, config=config)

# Step 2: Check for interrupts
state = agent.get_state(config)
if state.next:
    print(f"Pending action")

# Step 3: Approve and resume
result = agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), config=config)
```
</ex-approval-workflow>

<ex-reject-with-feedback>
Reject a pending action with feedback, prompting the agent to try a different approach.
```python
result = agent.invoke(
    Command(resume={"decisions": [{"type": "reject", "message": "Run tests first"}]}),
    config=config,
)
```
</ex-reject-with-feedback>

<ex-edit-before-execution>
Edit the proposed action arguments before allowing execution.
```python
result = agent.invoke(
    Command(resume={"decisions": [{
        "type": "edit",
        "edited_action": {
            "name": "execute_sql",
            "args": {"query": "DELETE FROM users WHERE last_login < '2020-01-01' LIMIT 100"},
        },
    }]}),
    config=config,
)
```
</ex-edit-before-execution>

<boundaries>
### What Agents CAN Configure

- Subagent names, tools, models, system prompts
- Which tools require approval
- Allowed decision types per tool
- TodoList content and structure

### What Agents CANNOT Configure

- Tool names (`task`, `write_todos`)
- HITL protocol (approve/edit/reject structure)
- Skip checkpointer requirement for interrupts
- Make subagents stateful (they're ephemeral)
</boundaries>

<fix-checkpointer-required>
Checkpointer is required when using interrupt_on for HITL workflows.
```python
# WRONG
agent = create_deep_agent(interrupt_on={"write_file": True})

# CORRECT
agent = create_deep_agent(interrupt_on={"write_file": True}, checkpointer=MemorySaver())
```
</fix-checkpointer-required>

<fix-thread-id-required-for-resumption>
A consistent thread_id is required to resume interrupted workflows.
```python
# WRONG: Can't resume without thread_id
agent.invoke({"messages": [...]})

# CORRECT
config = {"configurable": {"thread_id": "session-1"}}
agent.invoke({...}, config=config)
# Resume with Command using same config
agent.invoke(Command(resume={"decisions": [{"type": "approve"}]}), config=config)
```
</fix-thread-id-required-for-resumption>

<fix-interrupt-checks-between-invocations>
Interrupts happen BETWEEN invoke() calls, not mid-execution.
```python
result = agent.invoke({...}, config=config)       # Step 1: triggers interrupt
if "__interrupt__" in result:                      # Step 2: check for interrupt
    result = agent.invoke(                         # Step 3: resume
        Command(resume={"decisions": [{"type": "approve"}]}),
        config=config,
    )
```
</fix-interrupt-checks-between-invocations>
