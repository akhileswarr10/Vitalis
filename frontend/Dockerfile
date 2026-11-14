# ---- Stage 1: Build --------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src

ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ---- Stage 2: Production static serve (nginx) ------------------------------
FROM nginx:alpine AS runner

# RESTRICTIONS.md §4: non-root containers
RUN addgroup -S vitalis && adduser -S vitalis -G vitalis

# Configure nginx directories and permissions for non-root execution
RUN touch /var/run/nginx.pid && \
    chown -R vitalis:vitalis /var/run/nginx.pid /var/cache/nginx /var/log/nginx /etc/nginx/conf.d

COPY --from=builder /app/dist /usr/share/nginx/html
RUN chown -R vitalis:vitalis /usr/share/nginx/html

# Simple nginx config: serve SPA, forward unknown routes to index.html
RUN printf 'server {\n  listen 5173;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' \
    > /etc/nginx/conf.d/default.conf

USER vitalis

EXPOSE 5173

CMD ["nginx", "-g", "daemon off;"]

