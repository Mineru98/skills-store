#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes('--check');

const SECTORS = [
  ['software', 'SaaS', '고객 계정', '구독 결제', '배포 승인', '월간 사용량 보고서', 'legacy-billing-export', '요금제', '결제 실패', '고객 성공 매니저'],
  ['manufacturing', '제조', '생산 라인', '불량 검사', '설비 점검', '공정 수율 보고서', 'old-oee-batch', '설비 코드', '가동 중단', '공장 관리자'],
  ['finance', '금융', '법인 계좌', '이체 승인', '자금 세탁 검토', '일별 잔액 보고서', 'legacy-ledger-sync', '거래 목적', '이상 거래', '준법 담당자'],
  ['healthcare', '의료', '환자 예약', '처방 검토', '진료 접수', '대기 시간 보고서', 'old-claims-export', '알레르기 정보', '검사 결과 확정', '담당 의료진'],
  ['retail', '유통', '매장 재고', '반품 접수', '상품 진열', '카테고리 매출 보고서', 'legacy-stock-job', '반품 사유', '안전 재고 미달', '매장 관리자'],
  ['logistics', '물류', '배송 차량', '배차 요청', '상차 확인', '배송 지연 보고서', 'old-route-export', '도착 예정 시각', '배송 지연', '배차 담당자'],
  ['education', '교육', '수강 과정', '과제 제출', '출결 승인', '학습 진도 보고서', 'legacy-grade-csv', '학습 목표', '과제 마감', '담당 강사'],
  ['public', '공공', '민원 접수', '보조금 신청', '서류 심사', '민원 처리 보고서', 'old-civil-export', '신청인 유형', '처리 기한 임박', '민원 담당자'],
  ['media', '미디어', '콘텐츠 편성', '기사 발행', '저작권 검토', '채널 성과 보고서', 'legacy-feed-job', '콘텐츠 등급', '발행 실패', '편집 책임자'],
  ['gaming', '게임', '길드 활동', '아이템 거래', '제재 검토', '일일 접속 보고서', 'old-rank-export', '서버 지역', '비정상 거래', '운영 담당자'],
  ['travel', '여행', '여행 상품', '예약 변경', '환불 승인', '노선 판매 보고서', 'legacy-fare-sync', '여권 만료일', '항공편 취소', '여행 상담사'],
  ['real-estate', '부동산', '임대 매물', '계약 갱신', '입주 심사', '공실률 보고서', 'old-listing-feed', '보증금 유형', '계약 만료', '자산 관리자'],
  ['energy', '에너지', '발전 설비', '정비 요청', '출력 제한 승인', '시간대별 발전 보고서', 'legacy-meter-job', '계량기 상태', '출력 급감', '관제 담당자'],
  ['telecom', '통신', '기지국 장애', '회선 개통', '장애 복구 승인', '망 품질 보고서', 'old-cdr-export', '회선 유형', '품질 임계치 하락', '네트워크 운영자'],
  ['agriculture', '농업', '재배 구역', '농약 사용 기록', '수확 승인', '작황 예측 보고서', 'legacy-sensor-job', '토양 수분', '병해충 감지', '농장 관리자'],
  ['insurance', '보험', '보험 계약', '보험금 청구', '손해 사정 승인', '지급 소요 보고서', 'old-policy-export', '면책 사유', '고액 청구', '보상 담당자'],
  ['automotive', '자동차', '시험 차량', '정비 예약', '품질 판정', '결함 추적 보고서', 'legacy-vin-sync', '차대 번호', '안전 결함', '품질 관리자'],
  ['hospitality', '숙박', '객실 현황', '체크인 요청', '객실 배정', '점유율 보고서', 'old-booking-export', '투숙 인원', '노쇼 발생', '프런트 관리자'],
  ['hr', '인사', '채용 공고', '휴가 신청', '평가 승인', '인력 현황 보고서', 'legacy-payroll-csv', '고용 형태', '퇴사 예정', '인사 담당자'],
  ['cybersecurity', '보안', '보안 경보', '접근 권한 신청', '사고 대응 승인', '취약점 현황 보고서', 'old-siem-export', '위험 등급', '침해 징후', '보안 관제사'],
  ['construction', '건설', '공사 구역', '자재 반입', '안전 점검 승인', '공정 지연 보고서', 'legacy-bim-export', '작업 허가 번호', '안전 기준 위반', '현장 소장'],
  ['pharmaceutical', '제약', '임상 시험', '검체 등록', '시험 결과 승인', '이상 반응 보고서', 'old-trial-export', '시험군 코드', '중대한 이상 반응', '임상 관리자'],
  ['ecommerce', '전자상거래', '판매 상품', '주문 결제', '환불 검토', '전환율 보고서', 'legacy-order-feed', '배송 옵션', '결제 이탈', '셀러 매니저'],
  ['food-service', '외식', '매장 메뉴', '식자재 발주', '위생 점검', '폐기율 보고서', 'old-pos-export', '알레르기 표시', '냉장 온도 이탈', '매장 책임자'],
  ['research', '연구', '연구 과제', '실험 데이터 등록', '연구비 승인', '실험 재현성 보고서', 'legacy-lab-export', '표본 식별자', '장비 교정 만료', '연구 책임자'],
].map(([key, name, subject, item, process, report, legacy, field, event, actor]) => ({ key, name, subject, item, process, report, legacy, field, event, actor }));

const STYLES = ['concise', 'conversational', 'ticket', 'narrative'];
const REGIONS = ['서울', '부산', '대전', '광주', '제주'];
const CYCLES = ['1분기', '2분기', '3분기', '4분기', '연말'];
const CHANNELS = ['웹 운영', '모바일 운영', '야간 배치', '현장 단말'];
const PERIODS = ['오늘', '최근 7일', '이번 달', '분기', '사용자 지정 기간'];
const DECISIONS = ['single', 'split', 'coupled', 'partial', 'over_limit'];

function independentTasks(s, n) {
  const period = PERIODS[n % PERIODS.length];
  const seconds = 8 + (n % 9);
  return [
    { text: `${s.subject} 현황 화면에 ${period} 필터를 추가한다`, label: 'enhancement' },
    { text: `${s.item} 처리 중 같은 기록이 두 번 저장되는 문제를 수정한다`, label: 'bug' },
    { text: `사용하지 않는 ${s.legacy} 스크립트를 제거한다`, label: 'chore' },
    { text: `${s.process} 운영 절차 문서를 최신 정책에 맞게 갱신한다`, label: 'documentation' },
    { text: `${s.report} 조회가 ${seconds}초 넘게 걸리는 문제를 수정한다`, label: 'bug' },
    { text: `${s.report} 결과를 CSV로 내보내는 기능을 추가한다`, label: 'enhancement' },
    { text: `${s.field} 값이 비어도 저장되는 검증 오류를 수정한다`, label: 'bug' },
    { text: `${s.event} 발생 시 ${s.actor}에게 알림을 보내는 기능을 추가한다`, label: 'enhancement' },
    { text: `${s.subject} 카드의 정렬 순서를 사용자가 고정할 수 있게 한다`, label: 'enhancement' },
    { text: `${s.item} 검색 결과에서 페이지를 이동하면 필터가 초기화되는 문제를 수정한다`, label: 'bug' },
  ];
}

function coupledTasks(s, n) {
  const variants = [
    [
      { text: `${s.subject} API 응답에 ${s.field} 필드를 추가한다`, label: 'enhancement' },
      { text: `${s.subject} 목록에 새 ${s.field} 값을 표시한다`, label: 'enhancement' },
      {
        type: 'api-ui-contract',
        rationale: `API 필드를 소비하는 화면까지 바뀌어야 ${s.field} 정보가 사용자에게 전달된다.`,
      },
    ],
    [
      { text: `${s.item} 상태 코드에 보류 값을 추가한다`, label: 'enhancement' },
      { text: `${s.process} 화면에서 새 보류 상태를 선택할 수 있게 한다`, label: 'enhancement' },
      {
        type: 'shared-contract',
        rationale: '상태 계약과 소비 화면은 한 사용자 흐름을 완성하므로 따로 완료할 수 없다.',
      },
    ],
    [
      { text: `${s.report}가 UTC로 잘못 집계되는 문제를 수정해 지역 시간대로 맞춘다`, label: 'bug' },
      { text: `${s.report} CSV가 UTC로 잘못 출력되는 문제도 지역 시간대로 맞춘다`, label: 'bug' },
      {
        type: 'shared-root-cause',
        rationale: '화면과 내보내기의 시간대 불일치는 같은 집계 기준에서 함께 고쳐야 한다.',
      },
    ],
    [
      { text: `${s.field} 저장 형식을 새 코드 체계로 마이그레이션한다`, label: 'chore' },
      { text: `${s.subject} 조회 로직을 새 ${s.field} 코드 체계로 전환한다`, label: 'chore' },
      {
        type: 'migration-consumer',
        rationale: '데이터 마이그레이션과 조회 로직 전환 중 하나만 배포하면 기존 데이터를 읽지 못한다.',
      },
    ],
  ];
  return variants[n % variants.length];
}

function contextFor(s, n) {
  return `${s.name} 분야의 ${REGIONS[n % 5]} ${CYCLES[Math.floor(n / 5) % 5]} ${CHANNELS[Math.floor(n / 25) % 4]}`;
}

function renderQuery(context, requirements, style) {
  const texts = requirements.map((r) => r.text);
  if (style === 'concise') return `${context} 변경 요청입니다. ${texts.join('. ')}.`;
  if (style === 'conversational') return `${context}을 운영 중인데 ${texts.join(' 그리고 ')}. 서로 묶어야 하는지까지 판단해 주세요.`;
  if (style === 'ticket') return `${context} 요청사항:\n- ${texts.join('\n- ')}`;
  return `${context}에서 개선이 필요합니다. ${texts.join('. 또한 ')}. 각 변경의 의존성을 고려해 이슈를 나눠 주세요.`;
}

function makeCase(typeIndex, n, serial) {
  const decisionKind = DECISIONS[typeIndex];
  const sector = SECTORS[(n * 7 + typeIndex * 3) % SECTORS.length];
  const style = STYLES[(n + typeIndex) % STYLES.length];
  const ambiguity = ['low', 'medium', 'high'][(n + typeIndex * 2) % 3];
  const tasks = independentTasks(sector, n);
  const coupled = coupledTasks(sector, n);
  let requirements = [];
  let groups = [];
  let dependencies = [];
  let decision = decisionKind;
  let rationale = '';
  let exceptions = [];

  if (decisionKind === 'single') {
    requirements = [tasks[(n * 3) % tasks.length]];
    groups = [['r1']];
    rationale = '원자 요구사항이 하나뿐이므로 분할안을 만들지 않는다.';
  } else if (decisionKind === 'split') {
    const count = 2 + (n % 4);
    const sameLabelPool = n % 2 === 0 ? [0, 5, 7, 8] : [1, 4, 6, 9];
    const picks = n % 3 === 0
      ? sameLabelPool.slice(0, count)
      : Array.from({ length: count }, (_, i) => (n + i * 2) % tasks.length);
    requirements = picks.map((i) => tasks[i]);
    groups = requirements.map((_, i) => [`r${i + 1}`]);
    rationale = '각 요구사항은 독립적으로 배포·검증·취소할 수 있어 라벨이 같아도 별도 이슈다.';
  } else if (decisionKind === 'coupled') {
    requirements = coupled.slice(0, 2);
    groups = [requirements.map((_, i) => `r${i + 1}`)];
    dependencies = requirements.slice(1).map((_, i) => ({ from: 'r1', to: `r${i + 2}`, type: coupled[2].type }));
    decision = 'single';
    rationale = coupled[2].rationale;
    exceptions = ['여러 문장이지만 하나의 계약 또는 근본 원인을 공유한다.'];
  } else if (decisionKind === 'partial') {
    const count = 3 + (n % 3);
    requirements = [coupled[0], coupled[1]];
    const used = new Set(requirements.map((r) => r.text));
    for (let i = 0; requirements.length < count; i += 1) {
      const task = tasks[(n + i * 3) % tasks.length];
      if (!used.has(task.text)) { requirements.push(task); used.add(task.text); }
    }
    groups = [['r1', 'r2'], ...requirements.slice(2).map((_, i) => [`r${i + 3}`])];
    dependencies = [{ from: 'r1', to: 'r2', type: coupled[2].type }];
    rationale = '첫 두 요구사항은 강하게 결합되어 한 이슈로 묶고 나머지는 독립 이슈로 분리한다.';
  } else {
    const count = 6 + (n % 3);
    requirements = tasks.slice(0, count);
    groups = requirements.map((_, i) => [`r${i + 1}`]);
    rationale = '독립 그룹이 5개를 초과하므로 등록 전에 범위를 줄이거나 관련 작업을 묶도록 사용자 선택을 받는다.';
    exceptions = ['5개 상한 초과: 그대로 등록하지 않고 범위 조정 승인이 필요하다.'];
  }

  requirements = requirements.map((r, i) => ({ id: `r${i + 1}`, text: r.text, label: r.label }));
  const labels = groups.map((g) => requirements.find((r) => r.id === g[0]).label);
  const query = renderQuery(contextFor(sector, n), requirements, style);
  return {
    id: `split-${String(serial).padStart(3, '0')}`,
    query,
    industry: sector.key,
    style,
    ambiguity,
    requirements,
    expected_groups: groups,
    expected_group_labels: labels,
    expected_issue_count: groups.length,
    decision: decisionKind === 'over_limit' ? 'over_limit' : decision,
    dependencies,
    rationale,
    exceptions,
    tags: [decisionKind, requirements.every((r) => r.label === requirements[0].label) ? 'same-label' : 'mixed-label', `requirements-${requirements.length}`],
  };
}

function generate() {
  const all = [];
  let serial = 1;
  for (let typeIndex = 0; typeIndex < DECISIONS.length; typeIndex += 1) {
    for (let n = 0; n < 100; n += 1) all.push(makeCase(typeIndex, n, serial++));
  }
  const tuning = all.filter((_, i) => i % 5 !== 4);
  const holdout = all.filter((_, i) => i % 5 === 4);
  return { tuning, holdout };
}

function stableJson(value) { return `${JSON.stringify(value, null, 2)}\n`; }

const { tuning, holdout } = generate();
const outputs = [
  ['split-eval.json', tuning],
  ['split-holdout.json', holdout],
];
let changed = false;
for (const [name, data] of outputs) {
  const path = join(HERE, name);
  const next = stableJson(data);
  if (CHECK) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== next) {
      console.error(`✗ ${name} 이 생성 규칙과 다르다.`);
      changed = true;
    }
  } else {
    writeFileSync(path, next);
    console.log(`✓ ${name}: ${data.length}건`);
  }
}
if (CHECK) {
  if (changed) process.exit(1);
  console.log(`✓ 분해 데이터 생성 결과 일치: tuning ${tuning.length} + holdout ${holdout.length} = ${tuning.length + holdout.length}`);
}
