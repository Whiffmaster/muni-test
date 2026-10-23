# The API of the panel.
#
# The image has no data in it - the database is a single SQLite file in a
# volume that is mounted at /data. That way the data survives a restart of
# the container and the image can be rebuilt at any time.
#
# The build happens in three steps:
#   deps    - the packages that are needed to build
#   build   - the compiled API
#   runtime - only the packages that are needed to run it

FROM node:24-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# The version the workspace asks for (see devEngines in package.json).
RUN npm install -g pnpm@11.28.6

# ------------------------------------------------------------------ #
# the packages                                                        #
# ------------------------------------------------------------------ #

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/package.json packages/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter "@app/api..."

# ------------------------------------------------------------------ #
# the build                                                           #
# ------------------------------------------------------------------ #

FROM deps AS build
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @app/api build

# ------------------------------------------------------------------ #
# the runtime                                                         #
# ------------------------------------------------------------------ #

FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/package.json packages/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --prod --filter "@app/api..." \
  && pnpm store prune \
  && rm -rf /pnpm/store

COPY --from=build /app/apps/api/dist apps/api/dist
COPY packages packages

# The folders for the database and for the backups. They become the
# volumes, so the files inside belong to the user the server runs as.
RUN mkdir -p /data /backups && chown -R node:node /data /backups /app

USER node

EXPOSE 3000

# The API itself.
CMD ["node", "apps/api/dist/index.js"]
