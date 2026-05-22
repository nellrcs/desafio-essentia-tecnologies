import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'desafio_essentia',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;

// Função para inicializar o banco de dados (criar tabela se não existir)
export async function initDb() {
  const connection = await pool.getConnection();
  try {
    // Tabela de Tarefas
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tarefas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        concluido BOOLEAN DEFAULT FALSE,
        dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de Usuários
    await connection.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        deve_mudar_senha BOOLEAN DEFAULT TRUE,
        dataCriacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Inicializa usuário padrão se não existir
    const [rows]: any = await connection.query('SELECT * FROM usuarios WHERE username = ?', ['admin']);
    if (rows.length === 0) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT INTO usuarios (username, password, deve_mudar_senha) VALUES (?, ?, ?)',
        ['admin', hashedPassword, true]
      );
      console.log('Usuário admin padrão criado.');
    }

    console.log('Banco de dados inicializado com sucesso.');
  } catch (error) {
    console.error('Erro ao inicializar o banco de dados:', error);
  } finally {
    connection.release();
  }
}