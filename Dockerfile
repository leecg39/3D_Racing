FROM nginx:stable-alpine@sha256:dc5069ad14f19660b141b21236140b91656bf89bbc3e2417c70ae650cd66104c

ARG APP_REVISION=unknown
LABEL org.opencontainers.image.title="3DRacing" \
      org.opencontainers.image.source="https://github.com/leecg39/3D_Racing" \
      org.opencontainers.image.revision="${APP_REVISION}"

COPY deploy/hostinger/nginx.conf /etc/nginx/nginx.conf
COPY dist/ /usr/share/nginx/html/

USER nginx
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
