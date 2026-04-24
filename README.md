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

### 1. Cloner le dépôt

```bash
git clone https://github.com/ReeZeMvp/FramBourse.git
cd FramBourse
```

### 2. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Éditer `.env` :

```env
# URL que le navigateur utilise pour joindre le backend
# Si tu passes par Nginx Proxy Manager avec un domaine local :
NEXT_PUBLIC_API_URL=http://frambourse-api.home

# (Optionnel) Clé API OpenFIGI pour la résolution ISIN → ticker
# Gratuit, 25 000 req/jour : https://www.openfigi.com/api
OPENFIGI_API_KEY=

# Chemin absolu sur le Pi où stocker la base SQLite + uploads
DATA_DIR=/opt/frambourse/data
```

### 3. Créer le dossier de données persistent

```bash
sudo mkdir -p /opt/frambourse/data/uploads
sudo chown -R $USER:$USER /opt/frambourse/data
```

### 4. Build des images ARM64 et démarrage

```bash
# Build natif sur le Pi (ARM64 détecté automatiquement)
docker compose build

# Lancer en arrière-plan
docker compose up -d

# Vérifier que tout tourne
docker compose ps
docker compose logs -f
```

> **Cross-compilation depuis un PC x86 :** si tu build depuis ta machine Windows/Mac pour déployer ensuite sur le Pi, utilise :
> ```bash
> docker buildx build --platform linux/arm64 -t frambourse-api ./backend --push
> docker buildx build --platform linux/arm64 -t frambourse-ui ./frontend --push
> ```

### 5. Initialiser la base de données (première fois uniquement)

```bash
docker compose exec backend python seed.py
```

Cela crée les utilisateurs **Agathe** et **Victor** ainsi que leurs portefeuilles (PEA, CTO, PEE).

---

## Configuration Nginx Proxy Manager

Dans ton Nginx Proxy Manager (NPM), crée **deux Proxy Hosts** :

| Domaine | Scheme | Host | Port | Notes |
|---------|--------|------|------|-------|
| `frambourse.home` | http | `frambourse-ui` | 3000 | Interface web |
| `frambourse-api.home` | http | `frambourse-api` | 8000 | API backend |

> Les noms `frambourse-ui` et `frambourse-api` sont les noms de containers Docker définis dans `docker-compose.yml`. NPM et les containers doivent être sur le même réseau Docker, ou tu peux utiliser l'IP locale du Pi (`192.168.x.x`).

**Pour accéder depuis le réseau local**, ajoute les entrées DNS dans ton routeur (ou dans `/etc/hosts` sur chaque machine) :

```
192.168.1.XX  frambourse.home
192.168.1.XX  frambourse-api.home
```

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
