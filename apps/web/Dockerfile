# syntax=docker/dockerfile:1.7
#
# Imagen de la web (Next.js en modo standalone). El contexto es la raíz del repositorio:
#
#   docker build -f apps/web/Dockerfile -t paselibre-web:<etiqueta> .
#
# `tools/deploy/scripts/desplegar.sh` la construye con la etiqueta del commit.

FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@11.28.0 --activate

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config-eslint/package.json packages/config-eslint/package.json
COPY packages/config-typescript/package.json packages/config-typescript/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@paselibre/web..."

COPY apps/web apps/web
COPY packages/config-eslint packages/config-eslint
COPY packages/config-typescript packages/config-typescript
COPY packages/contracts packages/contracts
COPY packages/ui packages/ui

# Lo que Next fija al compilar: el destino de los rewrites (en producción nginx lleva /v1 y
# /media a la API antes de que lleguen aquí) y el WhatsApp del equipo, que viaja en el JavaScript
# del navegador (NEXT_PUBLIC_*). Cambiar el número obliga a reconstruir la imagen.
ARG API_INTERNAL_URL=http://api:3001
ARG NEXT_PUBLIC_WHATSAPP_EQUIPO=
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV NEXT_PUBLIC_WHATSAPP_EQUIPO=$NEXT_PUBLIC_WHATSAPP_EQUIPO

# `public` puede no existir en el repositorio (git no guarda carpetas vacías).
RUN mkdir -p apps/web/public \
    && pnpm --filter "@paselibre/web..." build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Dónde llama el servidor de Next a la API (la red interna de compose).
ENV API_INTERNAL_URL=http://api:3001

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /workspace/apps/web/public ./apps/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/salud').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
