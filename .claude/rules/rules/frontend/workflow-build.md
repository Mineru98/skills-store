# Build & Deploy Workflow Rules

## 적용 범위
로컬 개발·CI·컨테이너 빌드·배포 파이프라인. 모든 세션에 로드됩니다. 두 섹션으로 구성:
1. **원칙 (스택 중립)** — 어느 빌드 도구/오케스트레이터에도 적용.
2. **구현 가이드 (본 프로젝트)** — Yarn + Next.js + Docker.

## 원칙 (스택 중립)
- 빌드 전에 반드시 **lint → type-check → build** 순서로 검증한다.
- 환경값은 환경별 파일로 **분리**하고, 비밀값은 커밋하지 않는다.
- 컨테이너 이미지는 **멀티스테이지**로 작게 유지하고, 런타임 베이스 버전을 고정한다.
- 배포는 **되돌릴 수 있어야** 한다(이전 태그/이미지 보존 + 롤백 전략).
- 오케스트레이터(Swarm/K8s/ECS) 의 구체 명령은 rules 가 아니라 **런북 또는 skill** 로 분리한다.

## 구현 가이드 (본 프로젝트)

### RULE-BUILD-001 로컬 개발 명령
| 목적 | 명령 | 포트 |
| --- | --- | --- |
| 개발 서버 | `yarn dev` | 3000 |
| 테스트 환경 서버 | `yarn start:test` | 3001 |
| Storybook | `yarn storybook` | 6006 |
| 정적 export | `yarn export` | — |

포트는 충돌 방지를 위해 고정합니다. 포트를 바꿔야 하면 팀 공유 문서로 먼저 합의.

### RULE-BUILD-002 검증 순서
PR 전/빌드 전에 다음 순서로 실행합니다.

```bash
yarn lint           # ESLint
yarn type-check     # tsc --noEmit (스크립트 없다면 추가)
yarn build          # 프레임워크 빌드 (본 프로젝트는 next build)
```

`type-check` 스크립트가 없으면 `package.json` 에 추가합니다.

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

### RULE-BUILD-003 환경 파일 전략
| 파일 | 용도 | 커밋 |
| --- | --- | --- |
| `.env.development` | 로컬 개발 | 비밀값 없으면 커밋 |
| `.env.test` | 스테이징 | 비밀값 없으면 커밋 |
| `.env.production` | 운영 | 민감값 제외, CI secret 주입 권장 |
| `.env.*.local` | 로컬 오버라이드 | **절대 금지** |
| `.env.example` | 키 스켈레톤 | 커밋 필수 |

`NEXT_PUBLIC_*` (또는 동등한 클라이언트 노출 prefix) 는 클라이언트 번들에 포함되므로 비밀값 저장 금지.

### RULE-BUILD-004 Node / Yarn 버전 고정
- Dockerfile 베이스는 `node:{LTS}-alpine` 형태의 플레이스홀더로 두고, **`.nvmrc` 가 원천 진실**입니다. CI/Dockerfile 은 `.nvmrc` 의 버전과 동기화합니다.
- 로컬은 `.nvmrc` 또는 `volta` 로 동일 버전 사용.
- Yarn Berry 를 쓰면 `yarnPath` 와 `nodeLinker` 를 `.yarnrc.yml` 에 고정.

### RULE-BUILD-005 Dockerfile 멀티스테이지
세 단계로 분리해 런타임 이미지를 최소화합니다.

```
1) dependencies  - node:{LTS}-alpine + 의존성 설치
2) builder       - 프레임워크 빌드 -> 산출물(.next/, dist/ 등)
3) runner        - 산출물·public·package.json 만 포함, 런타임 포트, start 명령
```

- `NODE_ENV=production` 을 runner 에 명시.
- 빌드 아티팩트 외에는 복사하지 않아 이미지 슬림하게 유지.

### RULE-BUILD-006 이미지 태그 전략
- 모든 이미지는 **timestamp 태그(YYYY-MM-DD-HHMMSS)** + `latest` 두 태그로 push.
- 운영 롤백 시 timestamp 태그를 지정해 pull.
- `latest` 단일 태그만 쓰는 레거시 스크립트는 deprecate.

```bash
# 예시 (실제 명령은 런북 참조)
TAG=$(date +%Y-%m-%d-%H%M%S)
docker build -t "$REGISTRY/$APP:$TAG" -t "$REGISTRY/$APP:latest" .
docker push "$REGISTRY/$APP:$TAG" && docker push "$REGISTRY/$APP:latest"
```

### RULE-BUILD-007 배포 롤링 업데이트 원칙
오케스트레이터(Swarm/K8s/ECS) 와 무관하게 다음을 충족합니다.
- **순차 업데이트**: 한 번에 하나(또는 정의된 batch) 만 교체.
- **start-first**: 새 인스턴스가 healthy 가 된 뒤 구버전 종료.
- **자동 롤백**: 헬스체크 실패 시 직전 태그로 자동 복구.
- 배포 후 디스크/이미지 정리(`docker system prune` 등) 를 잊지 않는다.

> 구체적인 `docker service update` / `kubectl rollout` / `aws ecs update-service` 명령은 외부 런북 또는 skill (`build-and-deploy`) 로 분리합니다.

### RULE-BUILD-008 CI 파이프라인
CI 에서 다음 순서를 지킵니다.

```yaml
jobs:
  lint:       # yarn lint
  type-check: # yarn type-check
  test:       # yarn test (도입 후)
  build:      # yarn build
  image:      # 컨테이너 빌드 + Registry push (승인 게이트 후)
  deploy:     # 수동 approval → rolling update
```

- main push 는 lint/type-check/build 필수(test 는 도입 시 추가).
- 배포 단계는 **수동 승인** 게이트 권장.

### RULE-BUILD-009 보안 체크
- 번들에 개인 키/토큰이 포함되었는지 빌드 후 정적 검사(예: `grep -R "SECRET" .next/`).
- 인증 비밀키(`NEXTAUTH_SECRET` 등) 는 환경별 **분리 + 정기 로테이션**.
- 이미지 scan(Trivy 등) 을 CI 에 통합 권장.

### RULE-BUILD-010 배포 전 체크리스트
```
[ ] main 최신 동기화
[ ] yarn lint / yarn type-check / yarn build 성공
[ ] 관련 Storybook/E2E 통과 (도입 후)
[ ] .env.production 에 민감값이 하드코딩되지 않았는지 확인
[ ] 로컬에서 docker build 리허설
[ ] 배포 대상 태그가 Registry 에 존재하는지 확인
[ ] 오케스트레이터 서비스 상태 healthy
[ ] 배포 후 메트릭/로그 5분 관찰
```

### RULE-BUILD-011 실패 시 대응
- 배포 실패 → 자동 롤백이 동작했는지 확인. 실패 시 직전 timestamp 태그로 수동 롤백.
- 원인 분석 문서를 `docs/incidents/` 등에 남기고 재발 방지 규칙이 필요하면 `.claude/rules/` 로 승격.

## 참고
- [`testing.md`](./testing.md) — CI 테스트 단계(도입 후).
- Next.js 빌드: <https://nextjs.org/docs/app/building-your-application/deploying>
