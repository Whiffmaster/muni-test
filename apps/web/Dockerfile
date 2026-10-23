# The web panel.
#
# The panel is built with vite and served by nginx. The nginx also passes
# everything under /api to the API container, so the browser only needs one
# address and there is nothing to configure in the build.

FROM node:24-alpine AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install -g pnpm@11.28.6

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/package.json packages/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "web..."

COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter web build

# ------------------------------------------------------------------ #
# the runtime                                                         #
# ------------------------------------------------------------------ #

FROM nginx:alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
