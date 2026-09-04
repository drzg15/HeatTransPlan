# ── Build stage ───────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Vite inlines VITE_* at build time, so they have to be present here rather
# than in the container environment. Empty VITE_API_BASE means the browser
# calls /api on its own origin, which the outer Caddy routes to the backend.
ARG VITE_API_BASE=""
ENV VITE_API_BASE=$VITE_API_BASE
RUN npm run build

# ── Serve stage ───────────────────────────────────────────
# This image used to run `vite dev` in production, which shipped unminified
# sources as hundreds of separate module requests — slow on any mobile
# connection. It now serves the built bundle as static files.
FROM caddy:2-alpine

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

# Port 5173 is unchanged so the outer Caddyfile's `reverse_proxy frontend:5173`
# keeps working without edits.
EXPOSE 5173

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
