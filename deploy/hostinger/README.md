# Hostinger 배포

- 공개 주소: https://3dracing.soverin.cloud/
- 서버: `srv1655088.hstgr.cloud` (`72.61.116.250`)
- 서버 배포 폴더: `/docker/3dracing`
- Compose 프로젝트 / 컨테이너: `racing3d` / `racing3d-web-1`
- 배포한 게임 소스: `843bc1a106af05866605883d36b3dbc420e3ba13`
- 이미지: `3dracing:843bc1a`
- 현재 릴리스 파일: `/docker/3dracing/releases/843bc1a`

## 제공 방식

Vite의 `dist/`를 공식 Nginx Alpine 이미지에 포함한다. Nginx 기반 이미지는 Dockerfile의 digest로 고정했다. 브라우저가 사용하는 이미지·폰트·배경음·음원 크레딧을 모두 함께 제공한다.

Cloudflare의 `3dracing` A 레코드는 `72.61.116.250`을 가리키며 프록시가 켜져 있다. 기존 Traefik이 80/443 요청을 처리하고, 게임의 8080 내부 포트로 전달한다. HTTP는 HTTPS로 전환되며 원본 서버 인증서는 Traefik의 `letsencrypt` resolver가 발급·갱신한다. 도메인과 인증서에는 소문자 주소를 사용한다.

게임 컨테이너는 비특권 사용자, 읽기 전용 파일시스템, 임시 `/tmp`, 메모리 128MB로 실행한다. 호스트에 추가 포트를 공개하지 않는다. 로그는 파일당 10MB, 최대 3개로 순환하며 서버 재시작 후 자동 실행된다.

## 검증

- `npm test`: 33개 통과
- `npm run build`: 성공
- Nginx 설정 검사 및 컨테이너 healthcheck: 통과
- 원본 서버의 정적 파일 35개: HTTP 200 및 로컬 빌드와 크기 일치
- 배경음 2개의 Range 요청: HTTP 206
- 공개 HTTPS HTML: HTTP 200, 인증서 검증 성공, 로컬 `dist/index.html`과 SHA-256 일치
- Cloudflare 경유 HTTPS: HTML 200, MP3 Range 206
- 브라우저: 차고, 레이스, 원형 속도계, 일시정지, 배경음 전환 확인

세부 결과는 `asset-check.json`과 `deployment-report.json`에 기록한다.

## 운영 명령

서버의 `/docker/3dracing`에서 실행한다.

```sh
docker compose ps
docker compose logs --tail 100 web
docker compose up -d --wait --wait-timeout 60
```

새 배포는 로컬에서 테스트·빌드 후 `dist/`, `Dockerfile`, `.dockerignore`, `deploy/hostinger/nginx.conf`를 새 릴리스 폴더로 전송한다. 서버에서 `docker build --build-arg APP_REVISION=<전체 커밋> -t 3dracing:<커밋> .`로 이미지를 만들고, `/docker/3dracing/.env`의 `APP_REVISION`을 이미지 태그와 맞춘 뒤 Compose를 실행한다. Compose 설정을 변경했다면 `docker-compose.yml`도 배포 폴더에 함께 갱신한다.

기존 이미지와 릴리스 폴더를 보존하면 `.env`의 `APP_REVISION`을 이전 태그로 되돌리고 Compose를 실행해 복구할 수 있다. 최초 배포이므로 현재 기록에는 이전 운영 버전이 없다.
