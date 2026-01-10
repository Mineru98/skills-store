# Project Planning Methods

Frameworks for prioritization, phasing, and roadmap creation.

## Prioritization Frameworks

### MoSCoW Method

Categorize features by necessity:

| Category | Description | Effort % |
|----------|-------------|----------|
| **Must Have** | Critical for launch, product fails without | ~60% |
| **Should Have** | Important but not critical, workarounds exist | ~20% |
| **Could Have** | Nice to have, improves UX | ~20% |
| **Won't Have** | Explicitly out of scope for this phase | 0% |

**Example**:
```markdown
## MoSCoW Analysis

### Must Have (MVP Critical)
- [ ] User authentication
- [ ] Core data input/output
- [ ] Basic responsive layout
- [ ] Data persistence (localbase)

### Should Have
- [ ] Search functionality
- [ ] Data export
- [ ] Settings page

### Could Have
- [ ] Dark mode
- [ ] Keyboard shortcuts
- [ ] Animations

### Won't Have (Future)
- [ ] Real-time sync
- [ ] Multi-user collaboration
```

### RICE Scoring

Quantitative prioritization:

```
RICE Score = (Reach × Impact × Confidence) / Effort
```

| Factor | Description | Scale |
|--------|-------------|-------|
| **Reach** | Users affected per quarter | Number (e.g., 500) |
| **Impact** | Effect on user goal | 0.25=Minimal, 0.5=Low, 1=Medium, 2=High, 3=Massive |
| **Confidence** | Certainty of estimates | 20%=Low, 50%=Medium, 80%=High, 100%=Certain |
| **Effort** | Person-months | Number (e.g., 0.5, 1, 2) |

**Example**:
```markdown
| Feature | Reach | Impact | Confidence | Effort | RICE |
|---------|-------|--------|------------|--------|------|
| Search | 1000 | 2 | 80% | 1 | **1600** |
| Export | 500 | 1 | 100% | 0.5 | **1000** |
| Dark Mode | 800 | 0.5 | 50% | 0.5 | **400** |
```

### Kano Model

Categorize by user satisfaction:

| Type | If Missing | If Present | Priority |
|------|------------|------------|----------|
| **Must-be** | Dissatisfied | Neutral | Build first |
| **Performance** | Dissatisfied | Satisfied (linear) | Optimize |
| **Excitement** | Neutral | Delighted | Include if feasible |
| **Indifferent** | Neutral | Neutral | Skip |
| **Reverse** | Satisfied | Dissatisfied | Avoid |

**Example**:
```markdown
## Kano Analysis

### Must-be (Expected)
- Page loads without errors
- Data saves correctly
- Basic navigation works

### Performance (More is better)
- Fast load times (<2s)
- Search accuracy
- Export options

### Excitement (Delighters)
- Keyboard shortcuts
- Smart suggestions
- Smooth animations
```

### Eisenhower Matrix

Prioritize by urgency and importance:

```
              URGENT              NOT URGENT
         ┌─────────────────┬─────────────────┐
IMPORTANT│    Q1: DO       │   Q2: SCHEDULE  │
         │ - Critical bugs │ - Refactoring   │
         │ - Security      │ - Testing       │
         │ - Launch blocks │ - Documentation │
         ├─────────────────┼─────────────────┤
NOT      │   Q3: DELEGATE  │   Q4: ELIMINATE │
IMPORTANT│ - Minor polish  │ - Over-engineer │
         │ - Status updates│ - Unused features│
         │ - Small fixes   │ - Meetings      │
         └─────────────────┴─────────────────┘
```

## Phase Planning

### MVP Phases

```markdown
## Phase 1: Foundation (Weeks 1-2)
**Goal**: Project infrastructure

### Deliverables
- [ ] Project setup (HTML + Tailwind + JS)
- [ ] Basic UI framework
- [ ] Development environment
- [ ] Folder structure

### Exit Criteria
- Project builds successfully
- Basic page renders
- Tailwind configured

---

## Phase 2: Core Features (Weeks 3-6)
**Goal**: Implement Must-Haves

### Deliverables
- [ ] All Must-Have features
- [ ] Data persistence (localbase)
- [ ] Basic error handling
- [ ] Form validation

### Exit Criteria
- Core workflow complete end-to-end
- Data saves/loads correctly
- No critical bugs

---

## Phase 3: Enhancement (Weeks 7-10)
**Goal**: Implement Should-Haves

### Deliverables
- [ ] Search functionality
- [ ] Export feature
- [ ] Settings page
- [ ] Improved UX

### Exit Criteria
- All Should-Have features work
- Performance acceptable
- User testing complete

---

## Phase 4: Polish & Launch (Weeks 11-12)
**Goal**: Production ready

### Deliverables
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deployment

### Exit Criteria
- No known critical bugs
- Lighthouse score >90
- Documentation complete
```

## Work Breakdown Structure (WBS)

### Hierarchy

```
Level 1: Project
├── Level 2: Phases
│   ├── Level 3: Deliverables
│   │   ├── Level 4: Work Packages
│   │   │   └── Level 5: Tasks
```

### Example

```markdown
# WBS: Todo App

## 1. Discovery & Planning
### 1.1 Requirements
- 1.1.1 User interviews
- 1.1.2 Feature list
- 1.1.3 Prioritization

### 1.2 Design
- 1.2.1 Wireframes
- 1.2.2 Data model
- 1.2.3 Flow diagrams

## 2. Development
### 2.1 Frontend
- 2.1.1 Layout (HTML structure)
- 2.1.2 Styling (Tailwind)
- 2.1.3 Components (JS)

### 2.2 Data Layer
- 2.2.1 localbase setup
- 2.2.2 Repository classes
- 2.2.3 CRUD operations

### 2.3 Features
- 2.3.1 Task CRUD
- 2.3.2 Filtering
- 2.3.3 Search

## 3. Testing & Launch
### 3.1 Testing
- 3.1.1 Unit tests
- 3.1.2 Integration tests
- 3.1.3 User testing

### 3.2 Launch
- 3.2.1 Performance audit
- 3.2.2 Documentation
- 3.2.3 Deployment
```

## Dependency Management

### Critical Path

Identify the longest sequence of dependent tasks:

```markdown
## Critical Path Analysis

Task A (2 weeks) → Task B (1 week) → Task C (3 weeks) → Task D (1 week)
                                                        
Total: 7 weeks (this is the minimum project duration)

### Non-Critical Tasks (can run in parallel)
- Task E (2 weeks) - Has 5 weeks of float
- Task F (1 week) - Has 6 weeks of float
```

### Dependency Types

| Type | Description | Notation |
|------|-------------|----------|
| Finish-to-Start (FS) | B starts after A finishes | A → B |
| Start-to-Start (SS) | B starts when A starts | A ⇒ B |
| Finish-to-Finish (FF) | B finishes when A finishes | A ⇔ B |
| Start-to-Finish (SF) | B finishes when A starts | A ← B |

## Roadmap Template

```markdown
# Project Roadmap

## ✅ Completed
- [x] Project setup
- [x] Basic layout

## 🎯 Current Phase: Core Development

### Sprint 1 (Week 3-4)
**Goal**: User authentication

#### Must Have
- [ ] Login form UI
- [ ] Session storage
- [ ] Logout functionality

#### Should Have
- [ ] Remember me
- [ ] Password reset

### Sprint 2 (Week 5-6)
**Goal**: Task management

#### Must Have
- [ ] Task CRUD
- [ ] Task list view
- [ ] localbase integration

---

## 📋 Planned

### Phase 3: Enhancement (Weeks 7-10)
- [ ] Search
- [ ] Filters
- [ ] Export

### Phase 4: Polish (Weeks 11-12)
- [ ] Performance
- [ ] Documentation
- [ ] Launch

---

## 💡 Future Considerations
- [ ] Dark mode
- [ ] Mobile app
- [ ] Sync feature
```

## Milestone Definitions

```markdown
## Milestones

### M1: Foundation Complete ✓
**Date**: Week 2
**Criteria**:
- Project builds
- Basic UI renders
- Tailwind working

### M2: Alpha Release
**Date**: Week 6
**Criteria**:
- Core workflow complete
- Data persistence works
- No critical bugs

### M3: Beta Release
**Date**: Week 10
**Criteria**:
- All planned features
- User testing complete
- Performance acceptable

### M4: Production Release
**Date**: Week 12
**Criteria**:
- All bugs fixed
- Documentation complete
- Deployed to production
```

## Framework Selection Guide

| Situation | Use This |
|-----------|----------|
| Stakeholder communication | MoSCoW |
| Data-driven prioritization | RICE |
| Customer satisfaction focus | Kano |
| Daily task management | Eisenhower |
| Timeline planning | Critical Path |
| Scope definition | WBS |
