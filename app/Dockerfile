# 돌봄수첩 서버 이미지. onpod 무료 앱에 올린다(app/ 안에서):
#   onpod app deploy --build . --shape single --free-tier --name carenote --port 7860 --no-ai-ready --env SHOW_UNVERIFIED=1
# SHOW_UNVERIFIED=1은 검수 전 시안을 보여 줄 때만 준다. 화면 맨 위에 "검수 전 시안" 띠가 뜬다.
# 로컬에서 시험: docker build -t carenote app && docker run --rm -p 7860:7860 -e SHOW_UNVERIFIED=1 carenote
# 키(ANTHROPIC_API_KEY)는 이 파일과 저장소에 적지 않는다. 넣을 때는 배포한 사람이 직접 환경 변수로 넣는다.

FROM node:22-slim

# root가 아닌 node 사용자(UID 1000)로 돌린다.
WORKDIR /app
RUN chown node:node /app
USER node

# 의존성 먼저 설치해 내용만 바뀔 때는 이 단계를 다시 하지 않게 한다.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

# server.mjs는 기본으로 127.0.0.1:8787에서 연다. 컨테이너 밖에서 접속되도록 여기서만 연다.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=7860
EXPOSE 7860

CMD ["node", "server.mjs"]
