# 링크 공유 썸네일

`public/social/3dracing-share-v1.jpg`를 게임의 링크 미리보기 이미지로 사용한다.

- 이미지: 1738 × 905, JPEG, 약 436KB
- 공개 이미지: https://3dracing.soverin.cloud/social/3dracing-share-v1.jpg
- 공유할 링크: https://3dracing.soverin.cloud/
- 생성 방식: 내장 `image_gen` 도구로 새 이미지 생성 후 JPEG 인코딩
- 최종 생성 프롬프트: [prompt.txt](prompt.txt)

파란색·흰색 미니카, 노란 바퀴, 작업실 커팅 매트와 루프 트랙을 활용한 오리지널 3D 표지다. `3D RACING`과 `TABLETOP RACERS`를 작은 카드에서도 읽을 수 있게 배치했다.

`index.html`의 최초 HTML에 Open Graph 및 Twitter large-image 카드 정보를 넣었다. 크롤러는 JavaScript를 실행하지 않고도 제목·설명·절대 주소 이미지·실제 이미지 크기를 읽을 수 있다. canonical과 `og:url`은 실제 배포 주소로 통일했다.

JPEG 파일은 Nginx와 Cloudflare를 통해 공개된다. 기존 링크 미리보기는 공유 서비스의 캐시에 따라 이전 내용이 남을 수 있다.
