require('dotenv').config();
const express = require('express');
const pool = require('./db');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuração do Gemini
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const systemInstruction = `
### Persona
Você é o SecurityBot, um especialista em cibersegurança.
- Seu tom é amigável e direto.
- Use negrito e listas para explicar.

### Regra de Gamificação (Quiz)
Sempre que você explicar um conceito educativo (ex: phishing, senhas, firewall), ao final da resposta, gere um DESAFIO DE CONHECIMENTO.
O desafio deve vir em formato JSON dentro de um bloco de código, exatamente assim:

\`\`\`json
{
  "quiz": {
    "question": "Pergunta curta sobre o tema explicado?",
    "options": ["Alternativa A (Errada)", "Alternativa B (Certa)", "Alternativa C (Errada)"],
    "correctIndex": 1,
    "explanation": "Breve explicação do porquê a B está certa."
  }
}
\`\`\`

NUNCA dê a resposta no texto normal. O usuário deve clicar para responder.
`;

const model = genAI.getGenerativeModel({ 
    model: "gemini-2.0-flash", // Ou o modelo que estiver funcionando para você
    systemInstruction: systemInstruction
});

// --- NOVA FUNÇÃO: GERAR TÍTULO ---
async function generateChatTitle(firstMessage) {
    try {
        // Usa uma instância "leve" do modelo apenas para criar o título
        const titleModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        
        const prompt = `
        Analise a mensagem do usuário abaixo e crie um título muito curto (máximo 4 palavras) que resuma o assunto.
        Responda APENAS o título, sem aspas e sem explicações.
        
        Mensagem: "${firstMessage}"
        `;

        const result = await titleModel.generateContent(prompt);
        const title = result.response.text().trim();
        
        // Limpeza extra caso a IA coloque aspas ou ponto final
        return title.replace(/["\.]/g, '').substring(0, 50);
    } catch (error) {
        console.error("Erro ao gerar título:", error);
        return "Nova Conversa"; // Fallback se der erro
    }
}

// --- ROTAS DA API ---

// Rota 1: Enviar Mensagem (ATUALIZADA)
app.post('/message', async (req, res) => {
    const { sessionId, message } = req.body;

    if (!sessionId || !message) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        let newTitle = null; 

        // 1. Verifica/Cria Sessão
        const [sessionRows] = await pool.execute(
            'SELECT 1 FROM chat_sessions WHERE session_id = ?', 
            [sessionId]
        );

        if (sessionRows.length === 0) {
            newTitle = await generateChatTitle(message);
            await pool.execute(
                'INSERT INTO chat_sessions (session_id, title) VALUES (?, ?)',
                [sessionId, newTitle]
            );
        }

        // 2. Salva mensagem do usuário
        await pool.execute(
            'INSERT INTO chat_logs (session_id, role, message) VALUES (?, ?, ?)',
            [sessionId, 'user', message]
        );

        // 3. Gera resposta do Gemini
        const [rows] = await pool.execute(
            'SELECT role, message FROM chat_logs WHERE session_id = ? ORDER BY created_at ASC LIMIT 20',
            [sessionId]
        );
        
        const chatHistory = rows.map(row => ({
            role: row.role === 'user' ? 'user' : 'model',
            parts: [{ text: row.message }],
        }));
        
        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message);
        const botResponse = result.response.text();

        // 4. Salva resposta do bot E RECUPERA O ID
        const [botResult] = await pool.execute(
            'INSERT INTO chat_logs (session_id, role, message) VALUES (?, ?, ?)',
            [sessionId, 'model', botResponse]
        );
        
        const botMessageId = botResult.insertId; // <--- ID GERADO AQUI

        // 5. Resposta Final (ÚNICA) enviando o ID para o Frontend
        res.json({ 
            response: botResponse, 
            title: newTitle, 
            messageId: botMessageId // <--- Envia o ID corretamente
        });

    } catch (error) {
        console.error('Erro no processamento:', error);
        if (!res.headersSent) res.status(500).json({ error: 'Erro interno' });
    }
});

// Rota 2: Buscar Mensagens (Mantida igual)
app.get('/get-messages/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        const [rows] = await pool.execute(
            'SELECT role, message, created_at FROM chat_logs WHERE session_id = ? ORDER BY created_at ASC',
            [sessionId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar mensagens' });
    }
});

// Rota 3: Buscar Histórico (ATUALIZADA para ler da tabela de sessões)
app.get('/get-history-list', async (req, res) => {
    try {
        // Agora pegamos o título bonito gerado pela IA na tabela chat_sessions
        const [rows] = await pool.execute(`
            SELECT session_id, title, created_at 
            FROM chat_sessions 
            ORDER BY created_at DESC
        `);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao buscar histórico' });
    }
});

// Rota 4: Deletar Sessão (ATUALIZADA para limpar ambas as tabelas)
app.delete('/history/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    try {
        await pool.execute('DELETE FROM chat_logs WHERE session_id = ?', [sessionId]);
        await pool.execute('DELETE FROM chat_sessions WHERE session_id = ?', [sessionId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar' });
    }
});

// --- ROTA DE CADASTRO (SIGNUP) ---
app.post('/auth/signup', async (req, res) => {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos.' });
    }

    try {
        // 1. Verifica se email já existe
        const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ error: 'E-mail já cadastrado.' });
        }

        // 2. Criptografa a senha
        const saltRounds = 10;
        const hash = await bcrypt.hash(password, saltRounds);

        // 3. Salva no banco
        const [result] = await pool.execute(
            'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
            [name, email, hash]
        );

        res.status(201).json({ success: true, userId: result.insertId });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao criar conta.' });
    }
});

// --- ROTA DE LOGIN ---
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Busca usuário pelo email
        const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        const user = rows[0];

        // 2. Compara a senha enviada com o hash do banco
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Credenciais inválidas.' });
        }

        // 3. Retorna sucesso (Simples: devolve o ID e Nome para salvar no front)
        res.json({ 
            success: true, 
            user: { id: user.id, name: user.name, email: user.email } 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro no login.' });
    }
});

// --- ROTA DE PERFIL ---
app.get('/user/:id', async (req, res) => {
    const userId = req.params.id;
    try {
        const [rows] = await pool.execute(
            'SELECT name, email, level, points FROM users WHERE id = ?', 
            [userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar perfil' });
    }
});

// --- ROTA: ATUALIZAR DADOS DO PERFIL ---
app.put('/user/:id', async (req, res) => {
    const userId = req.params.id;
    const { name, email } = req.body;

    try {
        // Opcional: Verificar se email já existe em outra conta
        // ...

        await pool.execute(
            'UPDATE users SET name = ?, email = ? WHERE id = ?',
            [name, email, userId]
        );
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao atualizar dados.' });
    }
});

// --- ROTA: ALTERAR SENHA ---
app.put('/user/:id/password', async (req, res) => {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    try {
        // 1. Busca a senha atual (hash) no banco
        const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
        
        const user = rows[0];

        // 2. Verifica se a senha atual está correta
        const match = await bcrypt.compare(currentPassword, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Senha atual incorreta.' });
        }

        // 3. Criptografa a nova senha e salva
        const newHash = await bcrypt.hash(newPassword, 10);
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [newHash, userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao alterar senha.' });
    }
});

// --- ROTA DE GAMIFICAÇÃO: ADICIONAR PONTOS ---
app.post('/gamification/add-points', async (req, res) => {
   const { userId, points, messageId } = req.body; // Agora recebe messageId
    const pointsToAdd = Math.min(points, 100);

    if (!messageId) return res.status(400).json({ error: 'Message ID required' });

    try {
        // 1. Tenta registrar a tentativa PRIMEIRO
        // Se já existir (user_id + message_id), o banco vai dar erro de chave duplicada
        try {
            await pool.execute(
                'INSERT INTO quiz_attempts (user_id, message_id, points_earned) VALUES (?, ?, ?)',
                [userId, messageId, pointsToAdd]
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'Você já respondeu este quiz!' });
            }
            throw err;
        }

        // 2. Se passou, atualiza os pontos do usuário
        const [rows] = await pool.execute('SELECT points, level FROM users WHERE id = ?', [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

        let currentPoints = rows[0].points;
        let currentLevel = rows[0].level;
        
        const newPoints = currentPoints + pointsToAdd;
        
        let newLevel = currentLevel;
        if (newPoints < 500) newLevel = "Iniciante";
        else if (newPoints < 1500) newLevel = "Caçador de Bugs";
        else if (newPoints < 3000) newLevel = "Hacker Ético";
        else newLevel = "Criptógrafo Mestre";

        await pool.execute(
            'UPDATE users SET points = ?, level = ? WHERE id = ?',
            [newPoints, newLevel, userId]
        );

        res.json({ 
            success: true, 
            newPoints, 
            newLevel, 
            leveledUp: newLevel !== currentLevel 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Erro ao pontuar' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});