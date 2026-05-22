import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8083;

app.use(cors());
app.use(express.json());

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  concluido: boolean;
  dataCriacao: Date;
}

let tarefas: Tarefa[] = [
  {
    id: 1,
    titulo: 'Levar o lixo',
    descricao: 'Leva o lixo pra fora',
    concluido: false,
    dataCriacao: new Date(),
  },
  {
    id: 2,
    titulo: 'Banho no cachorro',
    descricao: 'Dar banhho no cachorro',
    concluido: true,
    dataCriacao: new Date(),
  },
];

app.get('/tarefas', (req, res) => {
  res.json(tarefas);
});

app.get('/tarefas/:id', (req, res) => {
  const id = Number(req.params.id);

  const tarefa = tarefas.find((t) => t.id === id);

  if (!tarefa) {
    return res.status(404).json({
      message: 'Tarefa não encontrada',
    });
  }
  res.json(tarefa);
});

app.post('/tarefas', (req, res) => {
  const { titulo, descricao } = req.body;

  if (!titulo) {
    return res.status(400).json({
      message: 'O campo titulo é obrigatório',
    });
  }

  const newTarefa: Tarefa = {
    id: tarefas.length > 0 ? tarefas[tarefas.length - 1].id + 1 : 1,
    titulo,
    descricao: descricao || '',
    concluido: false,
    dataCriacao: new Date(),
  };

  tarefas.push(newTarefa);

  res.status(201).json({
    message: 'Tarefa criada com sucesso',
    tarefa: newTarefa,
  });
});

app.put('/tarefas/:id', (req, res) => {
  const id = Number(req.params.id);

  const { titulo, descricao, concluido } = req.body;

  const tarefaIndex = tarefas.findIndex((t) => t.id === id);

  if (tarefaIndex === -1) {
    return res.status(404).json({
      message: 'Tarefa não encontrada',
    });
  }

  tarefas[tarefaIndex] = {
    ...tarefas[tarefaIndex],
    titulo: titulo ?? tarefas[tarefaIndex].titulo,
    descricao: descricao ?? tarefas[tarefaIndex].descricao,
    concluido: concluido ?? tarefas[tarefaIndex].concluido,
  };

  res.json({
    message: 'Tarefa atualizada com sucesso',
    tarefa: tarefas[tarefaIndex],
  });
});

app.patch('/tarefas/:id/complete', (req, res) => {
  const id = Number(req.params.id);

  const tarefa = tarefas.find((t) => t.id === id);

  if (!tarefa) {
    return res.status(404).json({
      message: 'Tarefa não encontrada',
    });
  }

  tarefa.concluido = true;

  res.json({
    message: 'Tarefa marcada como concluída',
    tarefa,
  });
});

app.patch('/tarefas/:id/uncomplete', (req, res) => {
  const id = Number(req.params.id);

  const tarefa = tarefas.find((t) => t.id === id);

  if (!tarefa) {
    return res.status(404).json({
      message: 'Tarefa não encontrada',
    });
  }

  tarefa.concluido = false;

  res.json({
    message: 'Tarefa marcada como não concluída',
    tarefa,
  });
});

app.delete('/tarefas/:id', (req, res) => {
  const id = Number(req.params.id);

  const tarefaExists = tarefas.some((t) => t.id === id);

  if (!tarefaExists) {
    return res.status(404).json({
      message: 'Tarefa não encontrada',
    });
  }

  tarefas = tarefas.filter((t) => t.id !== id);

  res.json({
    message: 'Tarefa removida com sucesso',
  });
});


app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
}).on('error', (err) => {
  console.error('Erro ao iniciar o servidor:', err);
});