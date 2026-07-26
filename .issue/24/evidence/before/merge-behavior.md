# 변경 전 근거

- `issue-merge.mjs`에는 `preflight`와 `resolve` 서브커맨드가 없었다.
- inventory는 `overlapsWith`로 같은 파일 변경만 표시했다. 실제 충돌은 `merge --pr` 실패 뒤에야 알 수 있었다.
- merge 실패 출력은 CI·충돌·승인 부족을 한 hint로 묶어 호출부가 다시 조사해야 했다.
- 작업 브랜치에서 충돌을 해소하고 critic 검토·사용자 승인 뒤 push하는 절차가 없었다.

화면 변경이 없는 CLI·문서 작업이므로 이미지 캡처는 적용하지 않았다.
