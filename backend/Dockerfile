# ─── Étape 1 : build ───
FROM node:20-alpine AS builder
WORKDIR /app

# Dépendances (avec devDependencies pour le build)
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

# Code source
COPY . .

# Génère le client Prisma puis compile
RUN npx prisma generate
RUN npm run build

# ─── Étape 2 : runtime ───
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dépendances de production uniquement
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --omit=dev --no-audit --no-fund \
    && npx prisma generate

# Artefacts compilés
COPY --from=builder /app/dist ./dist

# Répertoire de session WhatsApp
RUN mkdir -p /app/.baileys_auth

EXPOSE 3001
CMD ["node", "dist/main.js"]
