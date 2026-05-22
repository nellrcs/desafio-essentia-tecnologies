import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// #region debug-point h1-package-check
try {
  fetch('http://127.0.0.1:7777/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: 'mongo-connection-fail',
      type: 'log',
      level: 'info',
      message: 'API starting, checking mongoose import...',
      timestamp: new Date().toISOString()
    })
  }).catch(() => {});
} catch (e) {}
// #endregion

import pool, { initDb } from './database.js';
import Log, { connectMongo, registrarLog } from './mongodb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORTA_SERVIDOR || 8083;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/desafio_logs';

// Inicializa o banco de dados
initDb();
connectMongo(MONGO_URI);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json());


app.get('/tarefas', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tarefas ORDER BY dataCriacao DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar tarefas', error });
  }
});

app.get('/tarefas/:id', async (req, res) => {
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

app.post('/tarefas', async (req, res) => {
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

app.put('/tarefas/:id', async (req, res) => {
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

app.patch('/tarefas/:id/complete', async (req, res) => {
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

app.patch('/tarefas/:id/uncomplete', async (req, res) => {
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

app.delete('/tarefas/:id', async (req, res) => {
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

app.get('/logs', async (req, res) => {
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
