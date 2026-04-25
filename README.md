# 🍓 FramBourse

Dashboard de suivi de portefeuille boursier — usage local, auto-hébergé sur Raspberry Pi 5.

**Stack :** Next.js 15 · FastAPI · SQLite · Docker · TailwindCSS · Recharts

---

## Fonctionnalités

- **Dashboard global** — valorisation, PnL, répartition géographique / sectorielle / par classe d'actifs
- **Module Dividendes** — YOC vs rendement courant, calendrier ex-dates, projection 12 mois, croissance YoY, risque de concentration
- **Performance** — comparaison benchmarks (MSCI World, S&P 500, CAC 40), comparatif PEA vs CTO net de fiscalité, exposition devises
- **Import Fortuneo** — export XLS portefeuille, enrichissement automatique via yfinance (secteur, historique dividendes, ISIN → ticker)
- **Import Amundi** — synthèse XLSB PEE/PERCOL
- **Paramètres fiscaux PEA** — date d'ouverture, cumul versements/retraits

---

## Prérequis

| Outil | Version minimale |
|-------|-----------------|
| Docker + Docker Compose | 24+ |
| Python | 3.12+ (dev local uniquement) |
| Node.js | 20+ (dev local uniquement) |

---

## Déploiement — Raspberry Pi 5 (production)

> **Stratégie :** les images Docker sont buildées par GitHub Actions (CI) et publiées sur GHCR.
> Le Pi **tire** les images pré-buildées — aucun `docker build` local nécessaire (évite les problèmes de BuildKit/containerd et la lenteur de compilation ARM64).

### 1. Préparer le réseau partagé (une seule fois)

FramBourse partage le Caddy de SimulIR. Il faut d'abord créer le réseau Docker que les deux stacks rejoignent :

```bash
docker network create caddy-net
```

### 2. Mettre à jour SimulIR pour rejoindre le réseau

```bash
cd ~/docker/simul_ir   # ou le chemin de ton stack SimulIR
git pull               # récupère le docker-compose.yml mis à jour
docker compose up -d --force-recreate caddy   # recrée uniquement Caddy avec le nouveau réseau
```

### 3. Cloner FramBourse et configurer

```bash
git clone https://github.com/ReeZeMvp/FramBourse.git ~/docker/FramBourse
cd ~/docker/FramBourse
cp .env.example .env
```

Éditer `.env` :

```env
NEXT_PUBLIC_API_URL=https://frambourse.kaalynn.fr/api
CORS_ORIGINS=["https://frambourse.kaalynn.fr"]
OPENFIGI_API_KEY=          # optionnel
DATA_DIR=/opt/frambourse/data
```

### 4. Créer le dossier de données

```bash
sudo mkdir -p /opt/frambourse/data/uploads
sudo chown -R $USER:$USER /opt/frambourse/data
```

### 5. Lancer FramBourse (pull + démarrage)

```bash
# Tirer les images pré-buildées depuis GHCR (pas de build local)
docker compose pull

# Démarrer
docker compose up -d

# Vérifier
docker compose ps
docker compose logs -f
```

### 6. Initialiser la base de données (première fois uniquement)

```bash
docker compose exec backend python seed.py
```

### 7. Mises à jour

À chaque nouveau push sur `main`, GitHub Actions rebuild et publie les images. Pour mettre à jour le Pi :

```bash
cd ~/docker/FramBourse
git pull
docker compose pull
docker compose up -d
```

---

## Architecture multi-site (Caddy partagé)

```
Internet
    │
    ▼
[Caddy — simul_ir stack]  ← port 80/443 du Pi
    │              │
    │  simulir.kaalynn.fr    → frontend:3000 / backend:8000   (réseau interne simul_ir)
    │  frambourse.kaalynn.fr → frambourse-ui:3000              (réseau caddy-net)
    │              └──────── → frambourse-api:8000 (strip /api) (réseau caddy-net)
    │
[caddy-net] ←── réseau Docker externe partagé
    ├── frambourse-api  (container FramBourse backend)
    └── frambourse-ui   (container FramBourse frontend)
```

Les deux stacks restent **indépendants** — seul Caddy est partagé via le réseau `caddy-net`.
Si SimulIR est mis à jour ou redémarré, FramBourse continue de tourner, et vice-versa.

---

## Développement local

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows : .venv\Scripts\activate
pip install -r requirements.txt

# Lancer l'API (hot reload)
uvicorn app.main:app --reload --port 8000

# Seed (première fois)
python seed.py

# Documentation interactive
open http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## Import des fichiers

### Fortuneo (portefeuille PEA/CTO)

1. Dans Fortuneo → **Mon portefeuille** → **Exporter** → format `.xls`
2. Dans FramBourse → page **Importer** → Source : `Fortuneo`
3. Sélectionner le portefeuille cible, activer l'enrichissement yfinance, déposer le fichier

> L'enrichissement récupère automatiquement : secteur, historique des dividendes, ticker Yahoo Finance. Il peut prendre **30 à 60 secondes** selon le nombre de lignes.

### Amundi (PEE / PERCOL)

1. Sur le portail Amundi Épargne Salariale → **Mes avoirs** → **Exporter** → format `.xlsb`
2. Dans FramBourse → page **Importer** → Source : `Amundi`
3. Sélectionner le portefeuille PEE correspondant

---

## Résolution ISIN → Ticker Yahoo Finance

La résolution se fait en 3 étapes (ordre de priorité) :

1. **OpenFIGI API** — résolution via la bourse principale du pays ISIN (recommandé, gratuit)
2. **Heuristique nom** — Fortuneo inclut le ticker entre parenthèses dans les libellés : `AIR LIQUIDE (AI)` → `AI.PA`
3. **Suffixe pays** — fallback basé sur le code ISO ISIN

Correspondances intégrées :

| Pays | Suffixe Yahoo |
|------|--------------|
| FR | `.PA` (Euronext Paris) |
| NL | `.AS` (Euronext Amsterdam) |
| DE | `.DE` (XETRA) |
| BE | `.BR` (Euronext Bruxelles) |
| IT | `.MI` (Borsa Italiana) |
| GB | `.L` (London Stock Exchange) |
| CH | `.SW` (SIX Swiss) |
| US | *(aucun)* |

---

## Mise à jour

```bash
git pull
docker compose build
docker compose up -d
```

La base SQLite est dans un volume Docker persistant — aucune perte de données lors des mises à jour.

---

## Structure du projet

```
FramBourse/
├── backend/
│   ├── app/
│   │   ├── main.py              # Point d'entrée FastAPI
│   │   ├── models/models.py     # Modèles SQLAlchemy (User, Portfolio, Holding, Dividend…)
│   │   ├── parsers/
│   │   │   ├── fortuneo.py      # Parser XLS Fortuneo
│   │   │   └── amundi.py        # Parser XLSB Amundi PEE
│   │   ├── services/
│   │   │   ├── enrichment.py    # ISIN → Ticker + yfinance
│   │   │   └── performance.py   # TWR, benchmarks, YoY dividendes
│   │   └── routers/             # Routes API REST
│   ├── seed.py                  # Initialisation BDD
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/                 # Pages Next.js (App Router)
│       │   ├── page.tsx         # Dashboard
│       │   ├── dividends/       # Module dividendes
│       │   ├── performance/     # Performance & benchmarks
│       │   ├── analysis/        # Tableau des positions
│       │   ├── geography/       # Répartition géographique
│       │   ├── import/          # Upload fichiers
│       │   └── settings/        # Profil fiscal PEA
│       ├── components/          # Composants réutilisables
│       └── lib/
│           ├── api.ts           # Appels API typés
│           └── utils.ts         # Formatage, couleurs
├── docker-compose.yml
├── .env.example
└── exemple/                     # Fichiers d'exemple pour les imports
```

---

## Limites connues

- **yfinance** peut être instable sur certains tickers — un retry manuel via la page Import suffit
- **SQLite** est adapté à 2 utilisateurs en local ; pour un usage partagé plus large, migrer vers PostgreSQL (changer `DATABASE_URL` et `aiosqlite` → `asyncpg`)
- Les données de marché ne sont pas en temps réel (snapshot au moment de l'import)

---

## Licence

[MIT](LICENSE)
