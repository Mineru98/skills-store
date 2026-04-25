# Skills Store — LangChain (TypeScript)

Codex와 Claude Code 환경에서 사용하는 **LangChain · LangGraph · Deep Agents 스킬 세트**의 TypeScript 버전입니다.

이 브랜치의 모든 코드 예시는 TypeScript (`langchain`, `@langchain/langgraph`, `deepagents`) 패키지를 기준으로 작성되어 있습니다. Python 버전은 `langchain-python` 브랜치를 참고하세요.

## 디렉터리 구조

```
.
├── .codex/
│   ├── AGENTS.md           # Codex 응답 규칙
│   └── skills/             # Codex 스킬 (LangChain/LangGraph/Deep Agents)
├── .claude/
│   └── skills/             # Claude 스킬 (동일 셋, Claude Code용 미러)
├── AGENTS.md
├── CLAUDE.md
├── LICENSE
└── README.md
```

`.codex/skills` 와 `.claude/skills` 는 동일한 스킬 카탈로그를 두 환경에서 사용할 수 있도록 미러링되어 있습니다.

## 스킬 카탈로그

각 스킬은 호출 트리거를 `description` 에 명시한 SKILL.md 한 장으로 구성됩니다.

### 진입점

| Skill | 설명 |
| --- | --- |
| `framework-selection` | 프로젝트 시작 시 LangChain · LangGraph · Deep Agents 중 어느 계층을 쓸지 결정. 다른 스킬보다 먼저 호출. |
| `langchain-dependencies` | 패키지 버전·설치·환경 요구사항 정리 (LangChain · LangGraph · LangSmith · Deep Agents). |

### LangChain

| Skill | 설명 |
| --- | --- |
| `langchain-fundamentals` | `createAgent()`, `tool()`, 미들웨어 기반 프로덕션 에이전트 작성. |
| `langchain-middleware` | `HumanInTheLoopMiddleware`, 커스텀 미들웨어 훅, Zod 구조화 출력. |
| `langchain-rag` | 도큐먼트 로더, `RecursiveCharacterTextSplitter`, OpenAI 임베딩, Chroma/FAISS/Pinecone. |

### LangGraph

| Skill | 설명 |
| --- | --- |
| `langgraph-fundamentals` | `StateGraph`, 노드/엣지, `Command`, `Send`, 스트리밍, 에러 처리. |
| `langgraph-persistence` | 체크포인터, `thread_id`, time travel, `Store`, 서브그래프 영속화. |
| `langgraph-human-in-the-loop` | `interrupt()`, `Command({ resume })`, 4단계 에러 처리 전략. |

### Deep Agents

| Skill | 설명 |
| --- | --- |
| `deep-agents-core` | `createDeepAgent()`, 하니스 아키텍처, SKILL.md 포맷, 설정 옵션. |
| `deep-agents-memory` | `StateBackend`, `StoreBackend`, `FilesystemMiddleware`, `CompositeBackend` 라우팅. |
| `deep-agents-orchestration` | `SubAgentMiddleware`, `TodoList` 기반 플래닝, HITL interrupt. |

## 사용 방법

### Codex 에서 사용

저장소를 클론한 뒤 `.codex/skills/` 의 스킬을 그대로 사용하거나, 필요한 스킬을 `~/.codex/skills/` 로 복사해 전역 등록합니다.

```text
/framework-selection
/langchain-fundamentals
```

### Claude Code 에서 사용

`.claude/skills/` 의 스킬은 키워드 자동 감지 또는 `Skill` 도구로 호출됩니다.

```text
/langgraph-fundamentals
/deep-agents-core
```

### 다른 저장소로 가져오기

`inst-skill` (다른 브랜치 제공) 이나 단순 복사로 개별 스킬을 다른 프로젝트에 이식할 수 있습니다.

## 권장 호출 순서

1. **`framework-selection`** — 어떤 계층(LangChain / LangGraph / Deep Agents) 으로 갈지 결정.
2. **`langchain-dependencies`** — 결정된 계층에 맞는 패키지·버전을 고정.
3. **계층별 fundamentals** — `langchain-fundamentals`, `langgraph-fundamentals`, `deep-agents-core` 중 해당 항목.
4. **세부 기능 스킬** — RAG, 미들웨어, persistence, HITL, memory, orchestration 등 필요에 따라.

## 라이선스

MIT License. 자세한 내용은 [LICENSE](LICENSE) 를 참고하세요.
