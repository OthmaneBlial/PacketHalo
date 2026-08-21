FROM node:22.23.2-alpine AS workspace
RUN npm install --global pnpm@10.15.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM workspace AS web-build
ARG VITE_PACKET_HALO_SERVER=same-origin
ENV VITE_PACKET_HALO_SERVER=$VITE_PACKET_HALO_SERVER
RUN pnpm --filter @packethalo/web build

FROM workspace AS control-build
RUN pnpm --filter @packethalo/control build

FROM workspace AS service-build
RUN pnpm build:services

FROM nginx:1.29.8-alpine AS web
ENV NGINX_ENVSUBST_FILTER=PACKETHALO_CONTROL_TOKEN PACKETHALO_CONTROL_TOKEN=""
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

FROM nginx:1.29.8-alpine AS control
COPY docker/nginx-control.conf /etc/nginx/conf.d/default.conf
COPY --from=control-build /app/apps/control/dist /usr/share/nginx/html

FROM node:22.23.2-alpine AS server
ENV NODE_ENV=production NODE_OPTIONS=--disable-warning=ExperimentalWarning PACKETHALO_HOST=0.0.0.0 PACKETHALO_PORT=8787 PACKETHALO_DATABASE=/data/packethalo.db PACKETHALO_CONTAINER_LOOPBACK=1
WORKDIR /app
RUN apk add --no-cache su-exec && mkdir /data && chown node:node /data
COPY --from=service-build --chown=node:node /app/dist/services/server.cjs ./server.cjs
COPY --chmod=0755 docker/server-entrypoint.sh ./server-entrypoint.sh
VOLUME ["/data"]
EXPOSE 8787
STOPSIGNAL SIGTERM
ENTRYPOINT ["/app/server-entrypoint.sh"]
CMD ["node", "server.cjs"]

FROM node:22.23.2-alpine AS simulator
ENV NODE_ENV=production PACKETHALO_SERVER=http://server:8787/api/events
WORKDIR /app
COPY --from=service-build --chown=node:node /app/dist/services/simulator.cjs ./simulator.cjs
USER node
STOPSIGNAL SIGTERM
CMD ["node", "simulator.cjs"]
