# ─── Étape 1 : build ───
FROM node:20-alpine AS builder
WORKDIR /app

# Outils requis par certaines dépendances :
#  - git : Baileys tire `libsignal` depuis un dépôt git
#  - python3/make/g++ : compilation native de libsignal (node-gyp)
# On force git à utiliser HTTPS au lieu de SSH (pas de clé SSH en conteneur).
RUN apk add --no-cache git python3 make g++ openssl libc6-compat \
    && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --global url."https://github.com/".insteadOf "git@github.com:"

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

# Mêmes outils : l'install de prod recompile aussi libsignal (dép. de Baileys).
RUN apk add --no-cache git python3 make g++ openssl libc6-compat \
    && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && git config --global url."https://github.com/".insteadOf "git@github.com:"

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
