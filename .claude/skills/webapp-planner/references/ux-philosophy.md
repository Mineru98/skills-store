# UX Philosophy Guide

Philosophical frameworks for explaining UX decisions.

## Don Norman's 7 Design Principles

From *The Design of Everyday Things*:

### 1. Visibility
Make essential elements visible so users know what actions are possible.

**Application**: Navigation should be obvious, not hidden. CTAs should stand out.

**Phrase**: "Enhances discoverability by making [X] immediately visible"

### 2. Feedback
Provide immediate response to every user action.

**Application**: Button states, loading indicators, success/error messages.

**Phrase**: "Provides clear feedback through [visual/audio/haptic] response"

### 3. Constraints
Limit possible actions to prevent errors.

**Application**: Disabled buttons, form validation, limited options.

**Phrase**: "Applies constraints to prevent [error type] by [mechanism]"

### 4. Mapping
Create clear relationship between controls and their effects.

**Application**: Left/right arrows for left/right navigation, up/down for volume.

**Phrase**: "Creates natural mapping between [control] and [effect]"

### 5. Consistency
Use familiar patterns users already understand.

**Application**: Standard icons, common interactions, platform conventions.

**Phrase**: "Maintains consistency with [platform/industry] standards"

### 6. Affordances
Design elements to suggest their use.

**Application**: Buttons look clickable, inputs look typeable, handles look draggable.

**Phrase**: "Affords [action] through [visual cue]"

### 7. Signifiers
Provide cues that indicate how to interact.

**Application**: Labels, icons, placeholder text, hover states.

**Phrase**: "Provides clear signifier for [interaction] via [element]"

## Nielsen's 10 Usability Heuristics

### 1. Visibility of System Status
Keep users informed about what's happening.

**Example**: Loading spinners, progress bars, "Saving..." indicators.

### 2. Match Between System and Real World
Use familiar language and concepts.

**Example**: Shopping cart icon, trash can for delete, folder metaphor.

### 3. User Control and Freedom
Provide clear exits and undo options.

**Example**: Cancel buttons, undo functionality, back navigation.

### 4. Consistency and Standards
Follow platform conventions.

**Example**: Blue underlined links, × to close, hamburger menu on mobile.

### 5. Error Prevention
Design to prevent problems before they occur.

**Example**: Confirmation dialogs, input validation, smart defaults.

### 6. Recognition Rather than Recall
Minimize memory load; make options visible.

**Example**: Dropdown menus vs. typing, recent searches, autocomplete.

### 7. Flexibility and Efficiency of Use
Accelerators for experts without hindering novices.

**Example**: Keyboard shortcuts, advanced settings, batch operations.

### 8. Aesthetic and Minimalist Design
Remove unnecessary information.

**Example**: Clean layouts, progressive disclosure, focused content.

### 9. Help Users Recognize, Diagnose, and Recover from Errors
Clear error messages with solutions.

**Example**: "File too large (max 5MB). Try compressing the image."

### 10. Help and Documentation
Easy-to-search help focused on user tasks.

**Example**: Contextual tooltips, onboarding tours, searchable FAQ.

## Phenomenological Perspectives

### Heidegger's Hammer

When technology works well, it becomes invisible—an extension of the user.

**Application**: The interface should disappear during successful use. Users notice UI only when something goes wrong.

**Phrase**: "Technology becomes extension of being-in-the-world"

### Thick Description

Detailed observation reveals subtle dimensions of ordinary activities.

**Application**: Watch users perform tasks to understand context, not just actions.

**Phrase**: "Thick description reveals [insight] about [user behavior]"

### Being-in-the-World

Prioritize connection and context over object nature.

**Application**: Design for how users live and work, not abstract use cases.

## Taoist Wu-Wei (Effortless Action)

### Flow State Design

Create conditions for effortless interaction.

**Strategies**:
1. **Clear purpose**: Keep desired end action visible
2. **Reduce friction**: Remove unnecessary steps
3. **One action at a time**: Maintain focus
4. **Go with user behavior**: Observe and adapt

**Phrase**: "Enables effortless action by [reducing friction / maintaining focus]"

## Documentation Patterns

### Pattern 1: Problem → Insight → Solution

```markdown
## UX Improvement: [Feature]

### Problem
[User pain point with specific context]
"Users abandon checkout at step 3/5"

### Insight
[Connect to design principle]
"This violates Nielsen #6: Recognition Rather than Recall.
Users couldn't remember previous selections."

### Solution
[Improvement with philosophical backing]
"Redesigned to show all options visibly, reducing cognitive load
by 40% and increasing completion from 65% to 89%."
```

### Pattern 2: Principle → Evidence → Rationale

```markdown
## Design Decision: [Component]

### Guiding Principle
Norman's Mapping: "Create clear relationship between controls and effects."

### Evidence
User interviews revealed 73% confusion about button functions.

### Rationale
Aligned button layout with control function spatially,
creating natural mapping users intuit without learning.
```

### Pattern 3: Annotated Wireframe

```markdown
┌─────────────────────────────────────┐
│ [1] Header                          │
├─────────────────────────────────────┤
│  [2] Search                         │
│  ┌─────────────┐                    │
│  │  Search...  │    [3] Results     │
│  └─────────────┘                    │
└─────────────────────────────────────┘

[1] Header — Nielsen #1 (Visibility of System Status)
    User always knows where they are in the application.

[2] Search — Nielsen #6 (Recognition > Recall)
    Users can search instead of remembering exact paths.

[3] Results — Norman's Feedback
    Immediate visual response to search input.
```

## Key Phrases Reference

### Norman's Principles
- "Enhances discoverability by..."
- "Creates natural mapping between..."
- "Provides clear signifiers for..."
- "Supports understanding through..."
- "Reduces cognitive load by..."
- "Affords [action] through..."

### Nielsen's Heuristics
- "Addresses heuristic #[X] by..."
- "Fulfills visibility of system status through..."
- "Supports recognition rather than recall by..."
- "Improves aesthetic and minimalist design with..."
- "Enables user control and freedom via..."

### Phenomenological
- "Technology becomes extension of being-in-the-world..."
- "Supports seamless interaction, making interface imperceptible..."
- "Thick description reveals..."

### Taoist
- "Enables effortless action..."
- "Supports flow state by..."
- "Reduces cognitive friction to achieve wu-wei..."
