import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';

import pool, { initDb } from './database.js';
import Log, { connectMongo, registrarLog } from './mongodb.js';

// @ts-ignore
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORTA_SERVIDOR || 8083;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/desafio_logs';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Inicializa o banco de dados
initDb();
connectMongo(MONGO_URI);

app.use(cors({
  origin: 'http://localhost:4200', // Ajuste para a URL do seu Angular
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json());
app.use(cookieParser());

// Middleware de Autenticação
const autenticar = (req: any, res: any, next: any) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Não autorizado' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};

// Endpoints de Auth
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const [rows]: any = await pool.query('SELECT * FROM usuarios WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(401).json({ message: 'Usuário não encontrado' });

    const usuario = rows[0];
    const passwordMatch = await bcrypt.compare(password, usuario.password);
    if (!passwordMatch) return res.status(401).json({ message: 'Senha incorreta' });

    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, deve_mudar_senha: usuario.deve_mudar_senha },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // Em produção deve ser true (HTTPS)
      sameSite: 'lax',
      maxAge: 3600000 // 1 hora
    });

    res.json({ 
      message: 'Login realizado com sucesso',
      usuario: { 
        id: usuario.id, 
        username: usuario.username, 
        deve_mudar_senha: !!usuario.deve_mudar_senha 
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro no servidor', error });
  }
});

app.post('/mudar-senha', autenticar, async (req: any, res) => {
  const { novaSenha } = req.body;
  const usuarioId = req.usuario.id;

  try {
    const hashedPassword = await bcrypt.hash(novaSenha, 10);
    await pool.query(
      'UPDATE usuarios SET password = ?, deve_mudar_senha = FALSE WHERE id = ?',
      [hashedPassword, usuarioId]
    );
    
    // Limpar cookie após mudar senha para forçar novo login ou atualizar token
    res.clearCookie('token');
    res.json({ message: 'Senha alterada com sucesso. Por favor, faça login novamente.' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao alterar senha', error });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logout realizado com sucesso' });
});

// Aplicar middleware de autenticação nos endpoints de tarefas e logs
app.get('/tarefas', autenticar, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tarefas ORDER BY dataCriacao DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar tarefas', error });
  }
});

app.get('/tarefas/:id', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [rows]: any = await pool.query('SELECT * FROM tarefas WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar tarefa', error });
  }
});

app.post('/tarefas', autenticar, async (req, res) => {
  const { titulo, descricao } = req.body;
  if (!titulo) {
    return res.status(400).json({ message: 'O campo titulo é obrigatório' });
  }
  try {
    const [result]: any = await pool.query(
      'INSERT INTO tarefas (titulo, descricao) VALUES (?, ?)',
      [titulo, descricao || '']
    );
    const [newRows]: any = await pool.query('SELECT * FROM tarefas WHERE id = ?', [result.insertId]);
    
    // Registrar Log
    await registrarLog('CRIAR_TAREFA', result.insertId, { titulo, descricao });

    res.status(201).json({
      message: 'Tarefa criada com sucesso',
      tarefa: newRows[0],
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao criar tarefa', error });
  }
});

app.put('/tarefas/:id', autenticar, async (req, res) => {
  const { id } = req.params;
  const { titulo, descricao, concluido } = req.body;
  try {
    const [existing]: any = await pool.query('SELECT * FROM tarefas WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    const updatedTitulo = titulo ?? existing[0].titulo;
    const updatedDescricao = descricao ?? existing[0].descricao;
    const updatedConcluido = concluido ?? existing[0].concluido;
    await pool.query(
      'UPDATE tarefas SET titulo = ?, descricao = ?, concluido = ? WHERE id = ?',
      [updatedTitulo, updatedDescricao, updatedConcluido, id]
    );
    const [updatedRows]: any = await pool.query('SELECT * FROM tarefas WHERE id = ?', [id]);
    
    // Registrar Log
    await registrarLog('ATUALIZAR_TAREFA', Number(id), { 
      titulo: updatedTitulo, 
      descricao: updatedDescricao, 
      concluido: updatedConcluido 
    });

    res.json({
      message: 'Tarefa atualizada com sucesso',
      tarefa: updatedRows[0],
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao atualizar tarefa', error });
  }
});

app.patch('/tarefas/:id/complete', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [result]: any = await pool.query('UPDATE tarefas SET concluido = true WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    const [updatedRows]: any = await pool.query('SELECT * FROM tarefas WHERE id = ?', [id]);
    
    // Registrar Log
    await registrarLog('CONCLUIR_TAREFA', Number(id));

    res.json({
      message: 'Tarefa marcada como concluída',
      tarefa: updatedRows[0],
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao concluir tarefa', error });
  }
});

app.patch('/tarefas/:id/uncomplete', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [result]: any = await pool.query('UPDATE tarefas SET concluido = false WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }
    const [updatedRows]: any = await pool.query('SELECT * FROM tarefas WHERE id = ?', [id]);
    
    // Registrar Log
    await registrarLog('DESMARCAR_TAREFA', Number(id));

    res.json({
      message: 'Tarefa marcada como não concluída',
      tarefa: updatedRows[0],
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao desmarcar tarefa', error });
  }
});

app.delete('/tarefas/:id', autenticar, async (req, res) => {
  const { id } = req.params;
  try {
    const [result]: any = await pool.query('DELETE FROM tarefas WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Tarefa não encontrada' });
    }

    // Registrar Log
    await registrarLog('REMOVER_TAREFA', Number(id));

    res.json({ message: 'Tarefa removida com sucesso' });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao remover tarefa', error });
  }
});

app.get('/logs', autenticar, async (req, res) => {
  try {
    const logs = await Log.find().sort({ timestamp: -1 }).limit(50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar logs', error });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
