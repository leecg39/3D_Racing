# 배경음 적용 결과

그란투리스모의 라운지 재즈와 전자음악 분위기를 참고해 Kevin MacLeod의 CC BY 4.0 음원 두 곡을 적용했습니다.

| 장면 | 곡 | 원본 정보 |
| --- | --- | --- |
| 차고·결과 화면 | Airport Lounge | 재즈, 약 5분 8초, 129 BPM |
| 카운트다운·레이스·리플레이 | Go Cart | 일렉트로닉, 약 3분 33초, 115 BPM |

그란투리스모 공식 OST를 사용한 것은 아닙니다. 곡 선정 근거와 작곡가의 원본 메타데이터는 [sources.json](sources.json)에 저장했습니다.

## 사용 방법

게임을 새로고침하고 화면을 클릭하거나 상단 ‘음악’ 버튼을 누르면 음악이 시작됩니다. 브라우저의 첫 사용자 입력이 필요합니다.

- 상단 ‘음악’: 배경음 켜기·끄기.
- 상단 ‘소리’: 효과음과 배경음 전체 음소거.
- 설정 → 배경음 음량: 효과음과 독립적인 음량. 기본값 28%.
- 설정 → 배경음 미리 듣기: 경주를 멈춘 상태에서 음악 확인.
- 설정 → 음원 정보: 곡 출처, 작곡가와 CC BY 4.0 링크.

장면 전환 시 페이드로 곡을 바꾸며, 일시정지와 창 포커스 상실 시 재생을 멈춥니다. 재개할 때 곡의 위치를 유지합니다. 파일은 게임에 포함되므로 실행 중 외부 음악 사이트에 의존하지 않습니다.

## 검증

- `npm test`: 33개 통과.
- `npm run test:music`: 실제 오디오 출력 분석을 포함한 10개 검증 통과.
- `npm run test:audio`: 기존 엔진·충돌·미리 듣기·음소거 등 7개 검증 통과.
- `npm run build`: 성공.
- 음원의 끝으로 이동해 실제 MP3 반복 재생 확인.
- 효과음 음량 0에서도 음악 출력 확인. 배경음만 끄면 엔진 소리는 유지됨.
- 설정 저장, 전체 음소거, 포커스 상실과 재개, 불러오기 실패 시 경주 유지 확인.
- 1440·1024·390px 화면에서 음악 버튼 확인.

[상세 검증](report.json) · [설정 화면](music-settings.png)

## 출처와 수정 사항

- [Airport Lounge — Kevin MacLeod](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100806)
- [Go Cart — Kevin MacLeod](https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1300006)
- [작곡가의 사용 조건](https://incompetech.com/music/royalty-free/licenses/)
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

게임용으로 128 kbps / 44.1 kHz MP3로 재인코딩했습니다. 재생 시 반복·음량·페이드를 적용합니다. 출처 표기는 설정 화면과 배포 파일에 함께 포함됩니다.
