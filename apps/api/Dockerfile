# syntax=docker/dockerfile:1.7
#
# Imágenes de la API. El contexto es la raíz del repositorio:
#
#   docker build -f apps/api/Dockerfile --target runtime -t paselibre-api:<etiqueta> .
#   docker build -f apps/api/Dockerfile --target migraciones -t paselibre-migraciones:<etiqueta> .
#
# `tools/deploy/scripts/desplegar.sh` las construye con la etiqueta del commit.

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@11.28.0 --activate

WORKDIR /workspace

# Primero solo los manifiestos: mientras no cambien, la instalación sale de la caché.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config-eslint/package.json packages/config-eslint/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@paselibre/api..."

COPY apps/api apps/api
COPY packages/config-eslint packages/config-eslint
COPY packages/config-typescript packages/config-typescript
COPY packages/contracts packages/contracts

# `pnpm deploy --prod` deja solo lo que corre la API. El cliente de Prisma se genera en el
# árbol de construcción y se copia al desplegado, que no trae la CLI.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @paselibre/api db:generate \
    && pnpm --filter "@paselibre/api..." build \
    && pnpm --filter @paselibre/api deploy --prod /opt/paselibre-api \
    && build_modules="$(dirname "$(dirname "$(realpath apps/api/node_modules/@prisma/client)")")" \
    && deployed_modules="$(dirname "$(dirname "$(realpath /opt/paselibre-api/node_modules/@prisma/client)")")" \
    && cp -R "$build_modules/.prisma/." "$deployed_modules/.prisma/"

# Tareas de una sola vez: migraciones, semilla y la primera cuenta del equipo. Va aparte del
# runtime para que la API final no lleve la CLI de Prisma ni tsx.
FROM build AS migraciones

ENV NODE_ENV=production

WORKDIR /workspace/apps/api

USER node

ENTRYPOINT ["node", "node_modules/prisma/build/index.js", "migrate", "deploy", "--schema=prisma/schema.prisma"]

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=3001
# Las fotos subidas viven en un volumen que nginx también sirve en /media.
ENV MEDIA_DIR=/data/media

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates dumb-init openssl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/media \
    && chown node:node /data/media

WORKDIR /app

COPY --from=build --chown=node:node /opt/paselibre-api ./

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/v1/salud').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
