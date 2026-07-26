# 🚀 Déployer CreditCEP AI sur Railway (bot WhatsApp en ligne 24/7)

Ce guide met en ligne le **backend + le bot WhatsApp** et le **dashboard**, avec
une base PostgreSQL managée, sur [Railway](https://railway.app). À la fin, un
**numéro WhatsApp répond automatiquement** quand on le contacte.

> ⏱️ ~15 minutes. Aucun serveur à administrer.

---

## 0. Prérequis

- Un compte **Railway** (railway.app — connexion avec GitHub).
- Le dépôt **`Louistatch/Botfinance`** (déjà prêt, configs incluses).
- **Un numéro WhatsApp dédié** au bot + le téléphone qui le détient (pour scanner
  le QR **une seule fois**). ⚠️ Utilisez un numéro dédié, pas votre numéro
  personnel (le bot répondra à tous ceux qui écrivent à ce numéro).

---

## 1. Créer le projet

1. Railway → **New Project** → **Deploy from GitHub repo** → choisir
   `Louistatch/Botfinance`.
2. Railway crée un premier service. On va le configurer comme **backend**, puis
   ajouter la base et le **dashboard**.

---

## 2. Base de données PostgreSQL

1. Dans le projet → **New** → **Database** → **Add PostgreSQL**.
2. Railway provisionne la base et expose la variable `DATABASE_URL`.

> Redis n'est **pas requis** pour le prototype (réservé à des évolutions futures).

---

## 3. Service **backend** (API + bot WhatsApp)

1. Ouvrez le service issu du dépôt → **Settings** :
   - **Root Directory** : `backend`
   - **Build** : Railway détecte `backend/railway.json` + `backend/Dockerfile`
     (migrations Prisma lancées automatiquement au démarrage).
2. **Variables** (onglet *Variables*) :

   | Variable | Valeur |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` *(référence le service Postgres)* |
   | `JWT_SECRET` | *(une longue chaîne secrète aléatoire)* |
   | `JWT_EXPIRES_IN` | `1d` |
   | `NODE_ENV` | `production` |
   | `API_PREFIX` | `api` |
   | `WHATSAPP_ENABLED` | `true` |
   | `WHATSAPP_AUTH_DIR` | `/data` |
   | `WHATSAPP_DEVICE_NAME` | `CreditCEP-AI` |
   | `SEED_DEFAULT_PASSWORD` | *(mot de passe des comptes de démo)* |

   > `PORT` est fourni **automatiquement** par Railway — ne pas le définir.

3. **Volume** (persistance de la session WhatsApp — sinon il faudrait re-scanner
   le QR à chaque redéploiement) :
   - Service backend → **Settings → Volumes** → **New Volume**
   - **Mount path** : `/data`

4. **Domaine public** : **Settings → Networking → Generate Domain**.
   Notez l'URL, ex. `https://creditcep-backend.up.railway.app`.

5. **Deploy**. Attendez le statut *Active* (le healthcheck interroge `/api/health`).

   Vérifiez : ouvrez `https://VOTRE-BACKEND.up.railway.app/api/health`
   → `{"status":"ok","database":"up"}`.

### (Optionnel) Données de démonstration

Pour peupler le dashboard avec les coopératives d'exemple (région Kara) :

```bash
# Une seule fois, avec la CLI Railway (npm i -g @railway/cli ; railway login)
railway link          # sélectionner le projet
railway run --service backend npm run seed
```

---

## 4. Service **dashboard** (tableau de bord)

1. Projet → **New** → **GitHub Repo** → `Louistatch/Botfinance` (le même dépôt).
2. Service → **Settings** :
   - **Root Directory** : `dashboard`
   - Railway détecte `dashboard/railway.json` + `dashboard/Dockerfile`.
3. **Variables** :

   | Variable | Valeur |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://VOTRE-BACKEND.up.railway.app/api` |

   > ⚠️ Cette variable est lue **au build** : renseignez-la **avant** le déploiement
   > (sinon redéployez après l'avoir définie).

4. **Settings → Networking → Generate Domain** → notez l'URL du dashboard.
5. **Deploy**.

Connexion au dashboard : compte `admin@creditcep.ai` / le
`SEED_DEFAULT_PASSWORD` choisi (si vous avez lancé le seed), sinon créez un admin
via l'API.

---

## 5. Connecter le numéro WhatsApp (le QR)

1. Ouvrez dans un navigateur :
   **`https://VOTRE-BACKEND.up.railway.app/api/whatsapp/qr`**
   → une image **QR Code** s'affiche.
   *(Si vous obtenez « 404 », le bot est déjà connecté ou en cours de démarrage —
   attendez 10 s et rechargez.)*
2. Sur le téléphone du numéro dédié :
   **WhatsApp → Réglages → Appareils connectés → Connecter un appareil** → scannez.
3. Dans les **logs** du service backend (onglet *Deployments → Logs*), vous verrez
   `✅ Bot WhatsApp connecté.` La session est sauvegardée sur le volume `/data`.

---

## 6. Tester (et envoyer à votre patron)

- Depuis **un autre téléphone**, envoyez un message (ex. `START` ou « Bonjour »)
  **au numéro connecté** → le bot répond et déroule le questionnaire jusqu'à la
  décision. ✅
- Chaque demande apparaît en temps réel dans le **dashboard**.

**Ce que vous envoyez à votre patron :**
1. Le **numéro WhatsApp** du bot (« Écris `START` à ce numéro pour tester »).
2. Le **lien du dashboard** (`https://VOTRE-DASHBOARD.up.railway.app`) avec le
   compte de démonstration.

---

## Notes importantes

- **Baileys** est une connexion WhatsApp **non-officielle** : parfaite pour un
  **prototype**, mais pour une mise en production à grande échelle, prévoyez la
  migration vers l'**API officielle WhatsApp Business (Meta)** — le moteur de
  décision et le dashboard restent identiques, seule la couche de messagerie
  change.
- Utilisez un **numéro dédié** au bot. N'envoyez pas de messages non sollicités
  en masse (risque de blocage du numéro par WhatsApp).
- Le volume `/data` conserve la session : pas besoin de re-scanner après un
  redéploiement.
- Coûts : Railway offre un crédit gratuit mensuel, suffisant pour un prototype ;
  au-delà, la facturation est à l'usage.
