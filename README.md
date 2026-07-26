# CreditCEP AI 🌾🤖

![CI](https://github.com/Louistatch/Botfinance/actions/workflows/ci.yml/badge.svg)

**Système intelligent d'analyse et d'octroi de crédit agricole pour coopératives, via WhatsApp.**

CreditCEP AI permet à une coopérative agricole de déposer une demande de crédit
directement depuis WhatsApp. Un bot conversationnel intelligent collecte les
informations nécessaires, puis un moteur de scoring (IA à base de règles métier
CEP / ProSMAT / microfinance) évalue automatiquement la demande et produit une
décision motivée :

- ✅ **Coopérative Éligible**
- ⚠️ **Coopérative Éligible sous conditions**
- ❌ **Coopérative Non Éligible**

Le tout est piloté depuis un **tableau de bord** (Next.js) avec statistiques,
cartographie, et exports Excel / PDF.

---

## 🏗️ Architecture

Monorepo articulé autour de deux applications, suivant une **Clean Architecture**
inspirée du **DDD** et des principes **SOLID** :

```
CreditCEP-AI/
├── backend/                 # API NestJS + Bot WhatsApp + Moteur IA
│   ├── prisma/              # Schéma & migrations Prisma (PostgreSQL)
│   └── src/
│       ├── config/          # Configuration typée (env)
│       ├── common/          # Guards, decorators, filters, DTO partagés
│       └── modules/
│           ├── prisma/          # Service Prisma (accès données)
│           ├── auth/            # JWT, rôles (Admin, Agent, Analyste)
│           ├── users/          # Gestion des utilisateurs
│           ├── cooperatives/   # Coopératives (agrégat métier)
│           ├── credit-requests/# Demandes de crédit (workflow)
│           ├── scoring/        # 🧠 Moteur de décision (11 scores + reco)
│           ├── whatsapp/       # 🤖 Bot Baileys + machine conversationnelle
│           └── dashboard/      # Statistiques & exports (Excel / PDF)
│
└── dashboard/               # Tableau de bord Next.js (App Router)
```

### Le moteur IA (cœur du produit)

Le module `scoring` implémente un **moteur de décision explicable** qui calcule
**11 scores** métier, puis un **score global /100**, un **niveau de risque**, une
**décision**, et un ensemble de **recommandations** (montant, durée, différé,
taux, garanties, cultures, conseils techniques et financiers).

Tous les seuils, poids et règles sont centralisés dans
[`backend/src/modules/scoring/scoring.rules.ts`](backend/src/modules/scoring/scoring.rules.ts)
afin d'être **audités et ajustés** dès que les documents officiels (Excel des CEP,
support PDF de formation, Termes de Référence) sont disponibles.

---

## 🚀 Démarrage rapide (Docker)

```bash
# 1. Copier la configuration d'exemple
cp .env.example .env

# 2. Lancer toute la stack (PostgreSQL, Redis, Backend, Dashboard)
docker compose up --build

# 3. Appliquer le schéma & les données de démonstration
docker compose exec backend npm run prisma:deploy
docker compose exec backend npm run seed
```

| Service        | URL                             |
|----------------|---------------------------------|
| API Backend    | http://localhost:3001           |
| Swagger (docs) | http://localhost:3001/api/docs  |
| Dashboard      | http://localhost:3000           |
| PostgreSQL     | localhost:5432                  |
| Redis          | localhost:6379                  |

### Connecter le bot WhatsApp

Au démarrage du backend, un **QR Code** est imprimé dans les logs
(`docker compose logs -f backend`) et exposé via l'API
(`GET /whatsapp/qr`). Scannez-le depuis **WhatsApp → Appareils connectés**.
La session est persistée sur disque (`backend/.baileys_auth`) : pas besoin de
re-scanner à chaque redémarrage.

---

## ☁️ Déploiement en ligne (bot WhatsApp 24/7)

Pour mettre le bot en ligne avec un **numéro WhatsApp qui répond en continu**,
suivez le guide pas-à-pas **[DEPLOY_RAILWAY.md](DEPLOY_RAILWAY.md)** (déploiement
managé sur Railway : PostgreSQL + backend/bot + dashboard, ~15 min). Les fichiers
`backend/railway.json` et `dashboard/railway.json` rendent le déploiement clé en
main ; la session WhatsApp est persistée sur un volume.

## 🧑‍💻 Développement local (sans Docker)

```bash
# Backend
cd backend
npm install
cp ../.env.example .env
npm run prisma:generate
npm run prisma:migrate      # nécessite une base PostgreSQL locale
npm run seed
npm run start:dev           # http://localhost:3001

# Dashboard (autre terminal)
cd dashboard
npm install
npm run dev                 # http://localhost:3000
```

---

## 👥 Rôles & authentification (JWT)

| Rôle              | Capacités                                                        |
|-------------------|------------------------------------------------------------------|
| `ADMIN`           | Tout : utilisateurs, coopératives, décisions, configuration      |
| `CREDIT_ANALYST`  | Analyse, revue et validation des décisions de crédit             |
| `AGENT`           | Saisie/suivi des coopératives et demandes sur le terrain         |

Comptes de démonstration créés par le seed (mot de passe : `ChangeMe123!`) :

- `admin@creditcep.ai` — ADMIN
- `analyste@creditcep.ai` — CREDIT_ANALYST
- `agent@creditcep.ai` — AGENT

---

## 🔌 Principales routes API

Documentation interactive complète : **`/api/docs`** (Swagger).

| Méthode | Route                                   | Description                          |
|---------|-----------------------------------------|--------------------------------------|
| POST    | `/auth/login`                           | Connexion (retourne un JWT)          |
| GET     | `/auth/me`                              | Profil courant                       |
| GET/POST| `/cooperatives`                         | Lister / créer une coopérative       |
| GET/POST| `/credit-requests`                      | Lister / créer une demande           |
| POST    | `/credit-requests/:id/evaluate`         | Lancer le moteur de scoring          |
| POST    | `/scoring/simulate`                     | Simuler un scoring sans persistance  |
| GET     | `/dashboard/stats`                      | KPIs globaux                         |
| GET     | `/dashboard/map`                        | Données de cartographie              |
| GET     | `/dashboard/export/excel`               | Export Excel                         |
| GET     | `/dashboard/export/pdf`                 | Export PDF                           |
| GET     | `/whatsapp/qr`                          | QR Code de connexion                 |
| GET     | `/whatsapp/status`                      | État de la session bot               |
| GET     | `/health`                               | Sonde de santé (liveness + base)     |

---

## 🧪 Tests

```bash
cd backend
npm test            # tests unitaires (moteur de scoring inclus)
npm run test:e2e    # tests end-to-end (API)
npm run test:cov    # couverture
```

Le moteur de scoring est couvert par une batterie de tests
([`backend/test/scoring.spec.ts`](backend/test/scoring.spec.ts)) validant les
trois classes de décision et la cohérence des recommandations.

---

## 📦 Stack technique

- **Runtime** : Node.js 20+, TypeScript
- **Backend** : NestJS 10, Prisma 5, PostgreSQL 16, Redis 7
- **Bot** : Baileys (WhatsApp Web multi-device)
- **Dashboard** : Next.js 14 (App Router), React 18
- **Infra** : Docker & Docker Compose
- **Docs** : Swagger / OpenAPI

---

## 📐 Règles métier & extensibilité

> ⚠️ Les seuils et pondérations livrés reposent sur les bonnes pratiques CEP /
> ProSMAT / microfinance agricole. Ils sont **paramétrés** et **documentés** dans
> `scoring.rules.ts`. Dès que les documents officiels (Excel CEP, PDF de
> formation, Termes de Référence) sont fournis, il suffit d'ajuster ce fichier
> unique — aucune logique applicative n'a besoin d'être réécrite.

---

## 📄 Licence

Projet livré à des fins d'évaluation. © CreditCEP AI.
