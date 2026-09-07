#!/bin/zsh
cd -- "${0:A:h}"
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  printf 'Node.js 22.12 이상을 설치한 뒤 다시 실행해 주세요.\n'
  read -k 1
  exit 1
fi
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
if curl -fsS http://127.0.0.1:5173/ 2>/dev/null | /usr/bin/grep -q 'TABLETOP RACERS'; then
  open http://127.0.0.1:5173/
  exit 0
fi
printf 'TABLETOP RACERS를 시작합니다. 종료하려면 이 창에서 Ctrl+C를 누르세요.\n'
(sleep 2; open http://127.0.0.1:5173/) &
npm run dev -- --port 5173
