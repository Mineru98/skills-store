# Mermaid Diagram Patterns

Patterns for creating flowcharts based on ai-diagrams-toolkit style.

## Flowchart Basics

### Syntax

```mermaid
flowchart TD
    A[Rectangle] --> B(Rounded)
    B --> C{Decision}
    C -->|Yes| D[Action]
    C -->|No| E[Other Action]
```

### Node Shapes

```
[Rectangle]     - Process/Action
(Rounded)       - Start/End
{Diamond}       - Decision
[[Subroutine]]  - Sub-process
[(Database)]    - Data store
((Circle))      - Connector
>Asymmetric]    - Input/Output
```

### Directions

```
TD / TB   - Top to Down
BT        - Bottom to Top
LR        - Left to Right
RL        - Right to Left
```

## User Flow Pattern

```mermaid
flowchart TD
    Start((Start)) --> Input[User Input]
    Input --> Validate{Valid?}
    Validate -->|Yes| Process[Process Data]
    Validate -->|No| Error[Show Error]
    Error --> Input
    Process --> Save[(Save to DB)]
    Save --> Success[Show Success]
    Success --> End((End))

    style Start fill:#22c55e,color:#fff
    style End fill:#22c55e,color:#fff
    style Error fill:#ef4444,color:#fff
    style Validate fill:#eab308,color:#000
```

## CRUD Flow Pattern

```mermaid
flowchart LR
    subgraph Create
        C1[Form] --> C2{Valid?}
        C2 -->|Yes| C3[(Save)]
        C2 -->|No| C1
    end

    subgraph Read
        R1[Request] --> R2[(Fetch)]
        R2 --> R3[Display]
    end

    subgraph Update
        U1[Edit Form] --> U2{Valid?}
        U2 -->|Yes| U3[(Update)]
        U2 -->|No| U1
    end

    subgraph Delete
        D1[Confirm?] -->|Yes| D2[(Remove)]
        D1 -->|No| D3[Cancel]
    end
```

## Authentication Flow

```mermaid
flowchart TD
    Start((Start)) --> Check{Logged In?}
    Check -->|Yes| Dashboard[Dashboard]
    Check -->|No| Login[Login Page]
    
    Login --> Submit[Submit Credentials]
    Submit --> Validate{Valid?}
    Validate -->|Yes| Store[Store Session]
    Validate -->|No| Error[Show Error]
    Error --> Login
    
    Store --> Dashboard
    Dashboard --> Logout[Logout]
    Logout --> Clear[Clear Session]
    Clear --> Start

    style Start fill:#22c55e,color:#fff
    style Error fill:#ef4444,color:#fff
    style Validate fill:#eab308,color:#000
```

## State Machine Pattern

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Loading: fetch()
    Loading --> Success: data received
    Loading --> Error: request failed
    Success --> Idle: reset()
    Error --> Loading: retry()
    Error --> Idle: dismiss()
```

## Sequence Diagram Pattern

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Interface
    participant S as Service
    participant DB as Database

    U->>UI: Click Submit
    UI->>UI: Validate Input
    alt Invalid Input
        UI-->>U: Show Error
    else Valid Input
        UI->>S: POST /api/data
        S->>DB: INSERT data
        DB-->>S: Success
        S-->>UI: 200 OK
        UI-->>U: Show Success
    end
```

## Component Architecture

```mermaid
flowchart TB
    subgraph UI[UI Layer]
        Pages[Pages]
        Components[Components]
    end

    subgraph Logic[Logic Layer]
        Services[Services]
        Hooks[Hooks]
    end

    subgraph Data[Data Layer]
        Repository[Repository]
        LocalBase[(LocalBase)]
        LocalStorage[(LocalStorage)]
    end

    Pages --> Components
    Components --> Hooks
    Hooks --> Services
    Services --> Repository
    Repository --> LocalBase
    Repository --> LocalStorage
```

## Error Handling Flow

```mermaid
flowchart TD
    Action[User Action] --> Try{Try Operation}
    Try -->|Success| Success[Success State]
    Try -->|Error| Catch{Error Type?}
    
    Catch -->|Validation| VError[Show Field Errors]
    Catch -->|Network| NError[Show Retry Option]
    Catch -->|Unknown| UError[Show Generic Error]
    
    VError --> Action
    NError --> Retry{Retry?}
    Retry -->|Yes| Action
    Retry -->|No| Cancel[Cancel Operation]
    UError --> Log[Log Error]
    Log --> Cancel

    style Success fill:#22c55e,color:#fff
    style VError fill:#ef4444,color:#fff
    style NError fill:#f97316,color:#fff
    style UError fill:#ef4444,color:#fff
```

## Color Conventions

Based on ai-diagrams-toolkit semantic colors:

```mermaid
flowchart LR
    Success[Success] --> Decision{Decision}
    Decision --> Error[Error]
    Decision --> Warning[Warning]
    Decision --> Info[Info]

    style Success fill:#22c55e,color:#fff
    style Error fill:#ef4444,color:#fff
    style Warning fill:#eab308,color:#000
    style Decision fill:#eab308,color:#000
    style Info fill:#3b82f6,color:#fff
```

| Color | Hex | Use |
|-------|-----|-----|
| Green | #22c55e | Success, Start, End |
| Red | #ef4444 | Error, Failure |
| Yellow | #eab308 | Decision, Warning |
| Blue | #3b82f6 | Information, Process |
| Gray | #6b7280 | Neutral, Disabled |

## Subgraph Pattern

```mermaid
flowchart TB
    subgraph Frontend[Frontend Layer]
        direction LR
        HTML[HTML]
        CSS[Tailwind CSS]
        JS[JavaScript]
    end

    subgraph Storage[Storage Layer]
        direction LR
        LS[LocalStorage]
        IDB[IndexedDB]
    end

    Frontend --> Storage
```

## Best Practices

### DO
- Use semantic colors consistently
- Keep diagrams focused (one flow per diagram)
- Label all edges with conditions
- Use subgraphs for logical grouping
- Include start/end nodes

### DON'T
- Create overly complex diagrams (>15 nodes)
- Mix multiple flows in one diagram
- Use unlabeled decision branches
- Forget error paths
- Skip validation steps

## Template

```mermaid
flowchart TD
    %% Start
    Start((Start)) --> Step1[First Step]
    
    %% Main Flow
    Step1 --> Decision{Decision Point?}
    Decision -->|Yes| Action1[Action A]
    Decision -->|No| Action2[Action B]
    
    %% Error Handling
    Action1 --> Validate{Valid?}
    Validate -->|Yes| Success[Success]
    Validate -->|No| Error[Error]
    Error --> Step1
    
    Action2 --> Success
    
    %% End
    Success --> End((End))
    
    %% Styles
    style Start fill:#22c55e,color:#fff
    style End fill:#22c55e,color:#fff
    style Error fill:#ef4444,color:#fff
    style Decision fill:#eab308,color:#000
    style Validate fill:#eab308,color:#000
```
