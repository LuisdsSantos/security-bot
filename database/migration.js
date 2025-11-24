require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
    // 1. Conecta SEM especificar o 'database' (apenas host, user, password)
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    console.log("🔌 Conectado ao MySQL!");

    try {
        // 2. Cria o banco de dados se ele não existir
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        console.log(`📦 Banco de dados '${process.env.DB_NAME}' verificado/criado.`);

        // 3. Seleciona o banco de dados para uso
        await connection.query(`USE \`${process.env.DB_NAME}\``);

        // 4. Cria a tabela de SESSÕES (chat_sessions)
        const createSessionsQuery = `
            CREATE TABLE IF NOT EXISTS chat_sessions (
                session_id VARCHAR(255) PRIMARY KEY,
                title VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await connection.execute(createSessionsQuery);
        console.log("✅ Tabela 'chat_sessions' criada com sucesso!");

        // 5. Cria a tabela de LOGS/MENSAGENS (chat_logs)
        const createLogsQuery = `
            CREATE TABLE IF NOT EXISTS chat_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                session_id VARCHAR(255) NOT NULL,
                role VARCHAR(50) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_session_id (session_id)
            );
        `;
        await connection.execute(createLogsQuery);
        console.log("✅ Tabela 'chat_logs' criada com sucesso!");

        // 6. Cria a tabela de USUÁRIOS
        const createUsersQuery = `
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                level VARCHAR(50) DEFAULT 'Iniciante',
                points INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        await connection.execute(createUsersQuery);
        console.log("✅ Tabela 'users' criada com sucesso!");

        // 7. Tabela de Tentativas de Quiz
        const createQuizAttemptsQuery = `
            CREATE TABLE IF NOT EXISTS quiz_attempts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                message_id INT NOT NULL,
                points_earned INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_attempt (user_id, message_id)
            );
        `;
        await connection.execute(createQuizAttemptsQuery);
        console.log("✅ Tabela 'quiz_attempts' criada com sucesso!");

    } catch (error) {
        console.error("❌ Erro na migração:", error);
    } finally {
        await connection.end();
        console.log("🔌 Conexão encerrada.");
    }
}

runMigration();