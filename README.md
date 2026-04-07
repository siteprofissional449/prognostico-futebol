# Prognóstico Futebol - Backend

API de prognósticos de futebol com áreas **Grátis**, **Premium** e **VIP**. Geração diária de palpites com base em probabilidade (odds).

## Requisitos

- Node.js 18+
- PostgreSQL

## Instalação

```bash
cd prognostico-futebol-backend
npm install
cp .env.example .env
# Edite .env com usuário/senha do PostgreSQL
```

## Banco de dados

Crie o banco no PostgreSQL:

```sql
CREATE DATABASE prognostico_futebol;
```

Ao subir a API, as tabelas são criadas automaticamente (`synchronize: true` em dev).

## Rodar

```bash
npm run start:dev
```

API em `http://localhost:3000`.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/auth/register` | Cadastro (body: `email`, `password`) |
| POST | `/auth/login` | Login (body: `email`, `password`) → retorna `access_token` e `plan` |
| GET | `/plans` | Lista planos (FREE, PREMIUM, VIP) |
| GET | `/predictions/public?plan=FREE&date=...` | Prognósticos do dia (público) |
| GET | `/predictions` | Prognósticos do dia (requer `Authorization: Bearer TOKEN`) |
| POST | `/football/generate-today` | Gera prognósticos do dia (rodar 1x/dia ou por cron) |
| GET | `/users/:id/plan` | Retorna o plano do usuário |

### Planos

- **FREE**: palpites com maior probabilidade (ex.: ≥ 65%).
- **PREMIUM**: FREE + palpites médios (ex.: 55–65%).
- **VIP**: todos os palpites.

## Gerar prognósticos todos os dias

Chame uma vez por dia (ex.: 6h):

```bash
curl -X POST "http://localhost:3000/football/generate-today"
```

Ou use um cron no servidor:

```cron
0 6 * * * curl -X POST http://localhost:3000/football/generate-today
```

## API de futebol (opcional)

Sem `FOOTBALL_API_KEY` no `.env`, a API usa **dados mock**. Para dados reais:

1. Crie uma chave em [Football-Data.org](https://www.football-data.org/).
2. Coloque no `.env`: `FOOTBALL_API_KEY=sua_chave`.

## IA para gerar palpites (opcional)

Se você informar `OPENAI_API_KEY`, o endpoint `POST /football/generate-today` usa IA
para escolher o mercado (`HOME_WIN`, `DRAW`, `AWAY_WIN`) e confiança por jogo.
Sem chave, o sistema continua com o cálculo automático por odds (fallback).

Variáveis:

- `OPENAI_API_KEY=sua_chave_openai`
- `OPENAI_MODEL=gpt-4o-mini` (ou outro modelo compatível)

---

## Como testar o projeto (SmartGol)

1. **Subir o backend**
   ```bash
   cd prognostico-futebol-backend
   npm install
   cp .env.example .env   # ajuste DB_* e JWT_SECRET se quiser
   npm run start:dev
   ```
   Deixe rodando em `http://localhost:3000`.

2. **Gerar palpites do dia** (em outro terminal)
   ```bash
   curl -X POST http://localhost:3000/football/generate-today
   ```
   Deve retornar algo como `{"count":3}`.

3. **Subir o frontend**
   ```bash
   cd smartgol-frontend
   npm install
   copy .env.local.example .env.local
   npm run dev -- -p 3001
   ```
   Acesse `http://localhost:3001`.

4. **Testar no navegador**
   - **Início**: abra a home e clique em "Ver palpites do dia".
   - **Palpites (sem login)**: em `/palpites` você vê a lista; troque FREE/PREMIUM/VIP para ver diferença.
   - **Cadastro**: `/cadastro` → e-mail e senha → cadastrar.
   - **Login**: `/login` → entrar com o mesmo e-mail/senha.
   - **Palpites (logado)**: em `/palpites` a lista usa o plano da sua conta (inicialmente FREE).
   - **Planos**: `/planos` mostra os três planos e preços.
