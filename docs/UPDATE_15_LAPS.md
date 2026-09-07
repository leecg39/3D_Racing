# 15바퀴 경주 변경

- 경주 길이를 3랩에서 15랩으로 변경했습니다. 차량마다 순서 있는 체크포인트 180개를 통과해야 완주합니다.
- 차고 안내, `1 / 15` 랩 표시, 완주 문구와 기록 안내가 `CONFIG.laps`를 사용하도록 바꿨습니다.
- 1랩은 건조, 2랩은 젖은 구간, 3~15랩은 비·횡풍을 유지합니다. 4랩 이후 날씨 표시가 `undefined`가 되거나 빗소리가 사라지지 않도록 수정했습니다.
- 15개 랩별 기록은 스크롤 가능한 3열 영역에 표시합니다. 리플레이는 마지막 15랩까지 전체 경주를 저장합니다.
- 기존 3랩 기록과 설정은 보존합니다. 저장 기록에 랩 수를 추가하고, 랩 수별 상위 10개를 별도로 관리합니다. 현재 기록 화면에는 15랩 기록만 표시합니다.
- 최고 속도 400km/h, 기본 속도 +150%, 오디오·바퀴 접지·충돌 효과는 유지합니다.

검증: `npm test` 25개, `npm run build`, `node tests/laps-browser.mjs`, `EVIDENCE_DIR=docs/evidence/15-laps HEADLESS=1 npm run test:browser`.

[빌드 검증](evidence/15-laps/production-report.json) · [전체 완주·리플레이 검증](evidence/15-laps/browser-report.json) · [빌드 시작 화면](evidence/15-laps/production-start.png)

기존 검증 문서의 3랩 완주 시간과 영상은 이전 버전의 이력입니다. 현재 버전의 15랩 경주와 직접 비교하지 않습니다.
