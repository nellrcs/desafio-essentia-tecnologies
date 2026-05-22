import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  acao: { type: String, required: true },
  tarefaId: { type: Number, required: true },
  detalhes: { type: Object },
  timestamp: { type: Date, default: Date.now }
});

const Log = mongoose.model('Log', logSchema);

export const connectMongo = async (uri: string) => {
  try {
    await mongoose.connect(uri);
    console.log('Conectado ao MongoDB com sucesso');
  } catch (error) {
    console.error('Erro ao conectar ao MongoDB:', error);
  }
};

export const registrarLog = async (acao: string, tarefaId: number, detalhes: any = {}) => {
  try {
    const novoLog = new Log({ acao, tarefaId, detalhes });
    await novoLog.save();
  } catch (error) {
    console.error('Erro ao registrar log no MongoDB:', error);
  }
};

export default Log;
