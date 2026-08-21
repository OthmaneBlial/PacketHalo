FROM node:22-alpine AS workspace
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

FROM nginx:1.29-alpine AS web
ENV NGINX_ENVSUBST_FILTER=PACKETHALO_CONTROL_TOKEN
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html

FROM nginx:1.29-alpine AS control
COPY docker/nginx-control.conf /etc/nginx/conf.d/default.conf
COPY --from=control-build /app/apps/control/dist /usr/share/nginx/html

FROM workspace AS server
ENV PACKETHALO_HOST=0.0.0.0 PACKETHALO_PORT=8787 PACKETHALO_DATABASE=/data/packethalo.db PACKETHALO_CONTAINER_LOOPBACK=1
VOLUME ["/data"]
EXPOSE 8787
CMD ["pnpm", "--filter", "@packethalo/server", "exec", "tsx", "src/index.ts"]

FROM workspace AS simulator
ENV PACKETHALO_SERVER=http://server:8787/api/events
CMD ["pnpm", "--filter", "@packethalo/simulator", "exec", "tsx", "src/index.ts"]
