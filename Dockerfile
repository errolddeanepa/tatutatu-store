ARG NODE_VERSION=22.14
FROM node:${NODE_VERSION}-bookworm-slim AS base

FROM base AS deps
WORKDIR /opt/storefront/deps
ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

# Install dependencies
COPY package*.json yarn.lock* .yarn* ./
# Install dependencies (no node_modules hoisting to final image yet)
RUN yarn install --immutable

FROM base AS builder
WORKDIR /opt/storefront/build
ARG MEDUSA_BACKEND_URL=http://localhost:10000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_b52f1cc6fa2b09c6654506d53e63112fca28484818bcff817c7568d91e35bd2f
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
ENV MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL}
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL}
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

# Build the application
COPY --from=deps /opt/storefront/deps .
COPY . .
RUN yarn build

FROM base AS runner
RUN apt-get update \
  && apt-get install --no-install-recommends -y tini=0.19.0-1+b3 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

USER node
WORKDIR /opt/storefront

COPY --from=builder --chown=node:node /opt/storefront/build/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=node:node /opt/storefront/build/.next/standalone ./
COPY --from=builder --chown=node:node /opt/storefront/build/.next/static ./.next/static

ARG NODE_ENV=production
ARG PORT=8000
ARG MEDUSA_BACKEND_URL=http://localhost:10000
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_b52f1cc6fa2b09c6654506d53e63112fca28484818bcff817c7568d91e35bd2f
ENV PORT=$PORT
ENV NODE_ENV=$NODE_ENV
ENV MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL}
ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=${MEDUSA_BACKEND_URL}
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

EXPOSE $PORT


ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
