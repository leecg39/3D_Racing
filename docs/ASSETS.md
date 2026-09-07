# 첨부 이미지 사용 내역

사용자가 제공한 7개 PNG를 `public/assets/source/`에 원본 그대로 복사했습니다. 소스 이미지 해상도는 모두 1448 × 1086입니다. 별도의 외부 게임 자산은 다운로드하지 않았습니다.

| 첨부 순서 | 프로젝트 파일 | 실제 사용 |
|---|---|---|
| 1 | [lineup.png](../public/assets/source/lineup.png) | 4종 차량의 이름·성향·색상·모델 제작 기준, 작업실 포스터, 도감 |
| 2 | [zephyr-parts.png](../public/assets/source/zephyr-parts.png) | 제퍼 선택 카드의 원본 차량 이미지, 3D 부품 구성 기준, 부품도 보기 |
| 3 | [bulldog-parts.png](../public/assets/source/bulldog-parts.png) | 불독 선택 카드의 원본 차량 이미지, 3D 부품 구성 기준, 부품도 보기 |
| 4 | [workshop.png](../public/assets/source/workshop.png) | 차고·서킷 주변 이미지 배경, 서킷 미리 보기 카드, 도감 |
| 5 | [track-blueprint.png](../public/assets/source/track-blueprint.png) | 작업실 모니터 화면, 서킷 설계도 화면, 수직 루프·고가 구간 제작 기준 |
| 6 | [interface.png](../public/assets/source/interface.png) | 보텍스·노바 카드 이미지, 남색·파랑·노랑 HUD 테마 기준, 도감 |
| 7 | [workshop-props.png](../public/assets/source/workshop-props.png) | 선풍기·공구함·책·노트·콘·PIT·비·부스트 표지판 이미지 소품, 도감 |

이미지 영역은 `src/assets.js`의 `ATLAS`에서 지정합니다. CSS 배경 위치와 Three.js 텍스처 UV로 필요한 영역을 표시하므로 원본 파일은 수정하지 않습니다. 투명 PNG의 경계에 포함된 일부 색 테두리는 원본에 포함된 표현입니다.

## 3D와 이미지의 구분

- 주행 차량은 새로 작성한 곡면 단면 기반 3D 모델입니다. 차체·샤시·모터·기어·타이어·롤러·배터리·윙을 분해·조립할 수 있습니다. 이미지의 형상과 색을 참고했으며, 원본과 동일한 고해상도 3D 스캔 모델은 아닙니다.
- 노면·레일·지지대·수직 루프·차량 위치는 실제 3D 트랙입니다. 설계도 이미지의 모든 도로 비율과 부가 요소를 1:1로 복제한 것은 아닙니다.
- 작업실 먼 배경과 일부 소품은 투명 이미지 평면입니다. 책상·커팅 매트·램프·머그·자·책 등의 기하 모델을 함께 사용합니다.
- HUD의 순위·시간·속도·버튼은 실시간 HTML입니다. 정적인 에셋 시트에 그려진 예시 순위·시간을 실제 게임 수치로 표시하지 않습니다.
- 선택 카드의 이미지는 첨부 원본이고, 차고 중앙 모델과 주행 차량은 3D입니다.

## 출처와 배포

사용자 제공 이미지의 제작 출처는 파일명상 ChatGPT Image이며 외부 저작권·상표 관계를 별도 검증하지 않았습니다. 공개 배포 권한에 대한 확인은 자산 소유자가 수행해야 합니다.

Three.js는 MIT, Vite는 MIT, Barlow·Noto Sans KR 폰트는 SIL Open Font License를 따릅니다. 배포되는 Three.js·폰트의 라이선스 원문을 `public/licenses/`와 `dist/licenses/`에 함께 포함했습니다. 폰트는 npm 패키지를 통해 로컬 번들로 제공되며 Google Fonts 서버에 접속하지 않습니다.

참고한 API 문서: [Three.js 설치](https://threejs.org/manual/en/installation.html), [CatmullRomCurve3](https://threejs.org/docs/pages/CatmullRomCurve3.html), [InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html).
