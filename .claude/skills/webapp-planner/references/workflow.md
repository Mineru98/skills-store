# Workflow Guide

Complete workflow for transforming vague requirements into detailed specifications.

## Phase 1: Discovery (Interviewer)

**Goal**: Extract clear requirements from vague customer input

**Process**:
1. Start with open-ended questions about the problem
2. Dig deeper with follow-up questions
3. Confirm understanding by repeating back
4. Document all requirements

**Output**: Requirements document with:
- Problem statement
- Target users
- Core features (must-have)
- Nice-to-have features
- Constraints and limitations

## Phase 2: Visualization (UI Sketcher)

**Goal**: Create ASCII wireframes from requirements

**Process**:
1. Identify main screens/views
2. Sketch layout structure
3. Add UI elements (buttons, inputs, lists)
4. Annotate with Tailwind class hints
5. Note interaction points

**Output**: ASCII wireframes for each screen

## Phase 3: Documentation (Documentation Writer)

**Goal**: Create comprehensive spec with UX philosophy

**Process**:
1. Transform requirements into user stories
2. Connect wireframes to UX principles (Norman/Nielsen)
3. Document acceptance criteria
4. Explain design rationale philosophically

**Output**: Markdown specification document

## Phase 4: Technical Research (Tech Researcher)

**Goal**: Define data architecture and storage patterns

**Process**:
1. Design localbase collections
2. Define repository pattern classes
3. Document CRUD operations
4. Plan file storage (if needed)

**Output**: Technical specification with code examples

## Phase 5: Flow Design (Mermaid Designer)

**Goal**: Visualize user journeys and system flows

**Process**:
1. Map user journeys from requirements
2. Create flowcharts for key processes
3. Document decision points and error paths
4. Generate Mermaid code

**Output**: Mermaid diagrams for all flows

## Phase 6: Interaction Design (Interactive Designer)

**Goal**: Define animations and micro-interactions

**Process**:
1. Identify interaction points from wireframes
2. Design hover/focus/active states
3. Plan transitions and animations
4. Write Tailwind animation code

**Output**: Animation specifications with code

## Phase 7: Planning (Planner)

**Goal**: Create development roadmap

**Process**:
1. Apply MoSCoW to features
2. Calculate RICE scores
3. Create WBS breakdown
4. Define phases and milestones
5. Identify dependencies

**Output**: Project roadmap with priorities

## Parallel Execution

Some phases can run in parallel:

```
Sequential:
Interviewer → UI Sketcher → Documentation Writer

Parallel after wireframes:
├── Tech Researcher
├── Mermaid Designer
└── Interactive Designer

Final:
Planner (needs all outputs)
```

## Handoff Checklist

Before moving to next phase:

- [ ] Current phase output complete
- [ ] Output reviewed for completeness
- [ ] Questions from next phase addressed
- [ ] Context documented for handoff
