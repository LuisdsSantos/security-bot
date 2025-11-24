# SecurityBot - Assistente de Cibersegurança Gamificado

O **SecurityBot** é um Chatbot inteligente focado em educação sobre cibersegurança,  desenvolvido com **Node.js**, **MySQL** e a **API do Google Gemini**. O projeto utiliza **IA Generativa (Google Gemini)** para ensinar conceitos complexos de forma simples, integrando um sistema de **Gamificação** onde o usuário ganha pontos e sobe de nível ao responder quizzes gerados dinamicamente pela IA.

O projeto conta com memória de conversação, histórico de sessões persistente no banco de dados, geração automática de títulos para as conversas e uma interface web responsiva.

---

## 📋 Pré-requisitos

Para rodar este projeto localmente ou em servidor, você precisará de:

* **Node.js** (Versão 18 ou superior).
* **MySQL Server** (Local via Workbench/Docker ou em nuvem como Aiven).
* **Chave de API do Google Gemini** (Obtida no [Google AI Studio](https://aistudio.google.com/)).
* **Git** (Para versionamento).

---

## 🚀 Passo 1: Estrutura do Projeto

Certifique-se de que seus arquivos estejam organizados na seguinte estrutura:

```text
security-bot/
│
├── .env                   # Configurações e Senhas
├── package.json           # Dependências
├── README.md              # Documentação
│
├── database/              # Banco de Dados
│   └── migration.js       # Script de criação automática das tabelas
│
├── src/                   # Backend (API)
│   ├── server.js          # Servidor Express, Rotas de Auth, Chat e Gamificação
│   └── db.js              # Pool de conexão MySQL
│
└── public/                # Frontend
    ├── css/               # Estilos (home.css, login.css, profile.css...)
    ├── js/                # Lógica (home.js, login.js, profile.js...)
    ├── index.html         # (Opcional, redireciona para welcome)
    ├── welcome.html       # Tela inicial
    ├── login.html         # Tela de Login
    ├── signup.html        # Tela de Cadastro
    ├── home.html          # Tela do Chat (Aplicação Principal)
    └── profile.html       # Dashboard do Usuário
```

## 📦 Passo 2: Instalação
1. Abra o terminal na pasta raiz do projeto.

2. Inicie o projeto (caso não tenha o `package.json`):

```Bash 
npm init -y
```
3. Instale as dependências necessárias:

```Bash
npm install express mysql2 dotenv cors @google/generative-ai bcrypt
```

4. Garanta que o `package.json` tenha o script de start:
```Bash 
"scripts": {
  "start": "node src/server.js",
  "dev": "node src/server.js"
 }
```
(Opcional: Instale `nodemon` para desenvolvimento: `npm install -D nodemon`)

## ⚙️ Passo 3: Configuração de Ambiente (.env)
Crie um arquivo chamado `.env` na raiz do projeto e preencha com suas credenciais.

Atenção: Se estiver usando MySQL local (Workbench), o `DB_HOST` geralmente é localhost e a porta `3306`.

Snippet de código

```bash
# Configurações do Servidor
PORT=3000

# Credenciais do Banco de Dados (MySQL)
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sua_senha_do_mysql
DB_NAME=security_bot
DB_PORT=3306

# Chave da API do Google Gemini
GOOGLE_API_KEY=Cole_Sua_Chave_Aqui_Sem_Espacos
```

## 🗄️ Passo 4: Configuração do Banco de Dados
O projeto inclui um script de migração que cria o banco de dados e as tabelas necessárias (`chat_logs` e `chat_sessions`) automaticamente.

Certifique-se de que seu servidor MySQL está rodando.

Execute o script de migração:

```Bash
node database/migration.js
```
**Resultado esperado:** Você deve ver mensagens como "Banco de dados verificado" e "Tabelas criadas com sucesso".

Nota: Se preferir criar manualmente via SQL (Workbench), execute:

```SQL
CREATE DATABASE IF NOT EXISTS security_bot;
USE security_bot;

-- 1. Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    level VARCHAR(50) DEFAULT 'Iniciante',
    points INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Sessões de Chat
CREATE TABLE IF NOT EXISTS chat_sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Logs de Mensagens
CREATE TABLE IF NOT EXISTS chat_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_session_id (session_id)
);

-- 4. Tentativas de Quiz (Evita duplicidade de pontos)
CREATE TABLE IF NOT EXISTS quiz_attempts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message_id INT NOT NULL,
    points_earned INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_attempt (user_id, message_id)
);
```

## ▶️ Passo 5: Executando a Aplicação 

Modo Local No terminal, execute:

```Bash
node src/server.js
```
Se tudo der certo, você verá: `Servidor MySQL rodando na porta 3000`.

Acesse no seu navegador: 👉 **http://localhost:3000**

## ☁️ Passo 6: Deploy (Opcional)

Para colocar em produção (online), recomenda-se a seguinte stack gratuita/barata:

Banco de Dados: Crie um serviço MySQL no Aiven ou Railway.

Atualize as variáveis `DB_HOST`, `DB_USER`, etc., no seu arquivo `.env` (ou nas configurações da plataforma de deploy).

Importante: No arquivo `src/db.js`, certifique-se de que a opção `ssl: { rejectUnauthorized: false }` esteja configurada para conexões em nuvem.

Aplicação: Use o Render ou Railway.

Conecte seu repositório GitHub.

Configure as Variáveis de Ambiente no painel da plataforma.

Comando de Build: `npm install`

Comando de Start: `node src/server.js`

## 🛠️ Solução de Problemas Comuns
Erro 500 ao enviar mensagem:

Verifique se a `GOOGLE_API_KEY` no `.env` está correta e sem espaços extras.

Verifique se o usuário/senha do MySQL estão corretos.

Erro 404 (Google Generative AI):

O modelo configurado no `src/server.js` (ex: `gemini-1.5-flash`) pode não estar disponível para sua chave.

Solução: Edite `src/server.js` e troque o modelo para `gemini-2.0-flash` ou `gemini-pro`.

Erro de CORS:

Se o frontend e backend estiverem em domínios diferentes, verifique a configuração `app.use(cors())` no `server.js`. Se estiverem no mesmo servidor (como configurado neste guia), isso não deve ocorrer.

## 📚 Funcionalidades Implementadas

Chat Inteligente: Respostas contextualizadas sobre cibersegurança.

Markdown: Suporte para formatação rica (negrito, listas, código) nas respostas.

Histórico Persistente: As conversas ficam salvas no MySQL e aparecem na barra lateral.

Gerenciamento de Sessão:

Novo Chat: Limpa a tela e cria nova sessão.

Excluir: Remove a conversa do banco de dados e da interface.

Títulos Automáticos: A IA gera um nome para a conversa baseada na primeira mensagem.

Design Responsivo: Funciona em Desktop e Mobile (com sidebar retrátil).
