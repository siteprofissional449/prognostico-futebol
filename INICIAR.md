# Como abrir o projeto no Node.js (Windows)

Siga os passos na ordem. Você já tem o PostgreSQL instalado.

---

## 1. Node.js

- Se ainda não instalou: baixe em [nodejs.org](https://nodejs.org) (versão LTS).
- Depois de instalar, **feche e abra de novo** o terminal (PowerShell ou CMD).
- Confirme que está ok:
  ```powershell
  node -v
  npm -v
  ```
  Deve aparecer a versão do Node e do npm.

---

## 2. Banco de dados no PostgreSQL

Crie o banco que a API vai usar:

1. Abra o **pgAdmin** (ou o `psql` no terminal).
2. Conecte no servidor PostgreSQL (geralmente usuário `postgres` e a senha que você definiu na instalação).
3. Clique com o botão direito em **Databases** → **Create** → **Database**.
4. Nome do banco: **`prognostico_futebol`**.
5. Salve.

Se preferir pelo terminal (com `psql` no PATH):

```powershell
psql -U postgres -c "CREATE DATABASE prognostico_futebol;"
```

---

## 3. Configurar o projeto

Na pasta do projeto (`prognostico-futebol-backend`):

### 3.1 Copiar o arquivo de ambiente

No PowerShell:

```powershell
copy .env.example .env
```

### 3.2 Editar o `.env`

Abra o arquivo **`.env`** no Cursor e ajuste principalmente:

| Variável       | O que colocar |
|----------------|----------------|
| `DB_PASSWORD`  | Senha do usuário `postgres` no PostgreSQL |
| `DB_USER`      | Se você usa outro usuário, troque; senão deixe `postgres` |
| `DB_NAME`      | Deixe `prognostico_futebol` (igual ao banco que você criou) |
| `JWT_SECRET`   | Pode deixar para desenvolvimento ou trocar por uma frase secreta |

Exemplo (só a senha mudando):

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=sua_senha_aqui
DB_NAME=prognostico_futebol
FOOTBALL_API_KEY=
JWT_SECRET=smartgol-dev-secret
```

Salve o arquivo.

---

## 4. Instalar dependências e subir a API

No terminal, na pasta **`prognostico-futebol-backend`**:

```powershell
npm install
npm run start:dev
```

Aguarde até aparecer algo como “Nest application successfully started”.  
A API estará em: **http://localhost:3000**

---

## 5. Testar

- **Planos:** abra no navegador: http://localhost:3000/plans  
- **Gerar palpites do dia** (em outro terminal):
  ```powershell
  curl -X POST http://localhost:3000/football/generate-today
  ```
- **Palpites públicos:** http://localhost:3000/predictions/public?plan=FREE

---

## Resumo rápido

1. Node.js instalado → `node -v` e `npm -v` ok  
2. PostgreSQL com banco `prognostico_futebol` criado  
3. `.env` criado (copy de `.env.example`) e `DB_PASSWORD` (e opcionalmente `DB_USER`) ajustados  
4. `npm install` → `npm run start:dev`  
5. Acessar http://localhost:3000  

Se der erro de conexão com o banco, confira usuário e senha no `.env` e se o PostgreSQL está rodando (serviço iniciado).
