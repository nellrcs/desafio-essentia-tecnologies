import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  concluido: boolean;
  dataCriacao: Date;
}

interface LogEntry {
  _id: string;
  acao: string;
  tarefaId: number;
  detalhes?: any;
  timestamp: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, CommonModule],
  template: `
    <section class="section">
      <div class="container" style="max-width: 800px;">
        
        <!-- Tela de Login -->
        @if (!usuarioLogado()) {
          <div class="column is-4 is-offset-4">
            <div class="box mt-6">
              <h2 class="title has-text-centered">Login</h2>
              <div class="field">
                <label class="label">Usuário</label>
                <div class="control">
                  <input class="input" type="text" [(ngModel)]="usernameInput" placeholder="admin">
                </div>
              </div>
              <div class="field">
                <label class="label">Senha</label>
                <div class="control">
                  <input class="input" type="password" [(ngModel)]="passwordInput" placeholder="admin123">
                </div>
              </div>
              @if (loginErro()) {
                <p class="help is-danger mb-3">{{ loginErro() }}</p>
              }
              <button class="button is-primary is-fullwidth" (click)="login()">Entrar</button>
            </div>
          </div>
        }

        <!-- Tela de Mudar Senha -->
        @else if (usuarioLogado()?.deve_mudar_senha) {
          <div class="column is-4 is-offset-4">
            <div class="box mt-6">
              <h2 class="title is-4 has-text-centered">Primeiro Acesso</h2>
              <p class="subtitle is-6 has-text-centered">Você precisa alterar sua senha padrão.</p>
              <div class="field">
                <label class="label">Nova Senha</label>
                <div class="control">
                  <input class="input" type="password" [(ngModel)]="novaSenhaInput" placeholder="Digite a nova senha">
                </div>
              </div>
              <button class="button is-warning is-fullwidth" (click)="mudarSenha()">Alterar e Sair</button>
            </div>
          </div>
        }

        <!-- Tela Principal -->
        @else {
          <div class="box">
            <div class="level is-mobile">
              <div class="level-left">
                <h1 class="title has-text-primary">Minhas Tarefas</h1>
              </div>
              <div class="level-right">
                <div class="buttons">
                  <button class="button is-small is-info is-light" (click)="toggleLogs()">
                    {{ mostrarLogs() ? 'Ocultar Logs' : 'Ver Logs' }}
                  </button>
                  <button class="button is-small is-danger is-light" (click)="logout()">Sair</button>
                </div>
              </div>
            </div>

            <!-- Painel de Logs -->
            @if (mostrarLogs()) {
              <div class="notification is-info is-light mb-5">
                <button class="delete" (click)="toggleLogs()"></button>
                <h2 class="subtitle is-6 has-text-weight-bold mb-2">Logs de Atividade (MongoDB)</h2>
                <div class="log-container" style="max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 0.85rem;">
                  @for (log of logs(); track log._id) {
                    <div class="log-entry mb-1 border-bottom">
                      <span class="has-text-grey">{{ log.timestamp | date:'HH:mm:ss' }}</span> - 
                      <span class="has-text-weight-bold" [ngClass]="getLogClass(log.acao)">{{ log.acao }}</span>: 
                      Tarefa #{{ log.tarefaId }}
                      @if (log.detalhes?.titulo) {
                        - <span class="is-italic">"{{ log.detalhes.titulo }}"</span>
                      }
                    </div>
                  } @empty {
                    <p class="has-text-grey-light">Nenhum log registrado ainda...</p>
                  }
                </div>
              </div>
            }

            <!-- Estatísticas -->
            <div class="level is-mobile mb-5">
              <div class="level-item has-text-centered">
                <div>
                  <p class="heading">Total</p>
                  <p class="title is-5">{{ totalTarefas() }}</p>
                </div>
              </div>
              <div class="level-item has-text-centered">
                <div>
                  <p class="heading">Concluídas</p>
                  <p class="title is-5 has-text-success">{{ tarefasConcluidas() }}</p>
                </div>
              </div>
              <div class="level-item has-text-centered">
                <div>
                  <p class="heading">Pendentes</p>
                  <p class="title is-5 has-text-danger">{{ tarefasPendentes() }}</p>
                </div>
              </div>
            </div>

            <!-- Formulário de Criação -->
            <div class="box has-background-light mb-5">
              <div class="field">
                <label class="label">Nova Tarefa</label>
                <div class="control">
                  <input 
                    class="input is-primary"
                    type="text" 
                    [(ngModel)]="novoTitulo" 
                    placeholder="Título da tarefa..."
                    (keyup.enter)="addTarefa()"
                  >
                </div>
              </div>
              <div class="field">
                <div class="control">
                  <textarea 
                    class="textarea is-primary" 
                    [(ngModel)]="novaDescricao" 
                    placeholder="Descrição (opcional)..."
                    rows="2"
                  ></textarea>
                </div>
              </div>
              <div class="field is-grouped is-grouped-right">
                <div class="control">
                  <button 
                    class="button is-primary" 
                    (click)="addTarefa()" 
                    [disabled]="!novoTitulo()"
                  >
                    <strong>Adicionar Tarefa</strong>
                  </button>
                </div>
              </div>
            </div>

            <!-- Lista de Tarefas -->
            <div class="tarefa-list">
              @for (tarefa of tarefas(); track tarefa.id) {
                <div class="card mb-4" [class.is-concluida]="tarefa.concluido">
                  <div class="card-content">
                    <div class="columns is-vcentered is-mobile is-multiline">
                      <div class="column is-narrow">
                        <label class="checkbox">
                          <input 
                            type="checkbox" 
                            [checked]="tarefa.concluido" 
                            (change)="toggleTarefa(tarefa)"
                            [disabled]="tarefaEditando() === tarefa.id"
                          >
                        </label>
                      </div>

                      <div class="column is-flex-grow-1">
                        @if (tarefaEditando() === tarefa.id) {
                          <div class="field">
                            <div class="control">
                              <input 
                                class="input is-small is-info mb-2"
                                type="text" 
                                [(ngModel)]="tituloEditando" 
                                placeholder="Título"
                              >
                            </div>
                            <div class="control">
                              <textarea 
                                class="textarea is-small is-info" 
                                [(ngModel)]="descricaoEditando" 
                                placeholder="Descrição"
                                rows="2"
                              ></textarea>
                            </div>
                          </div>
                        } @else {
                          <div [style.opacity]="tarefa.concluido ? 0.6 : 1">
                            <h3 class="is-size-5 has-text-weight-semibold" [style.text-decoration]="tarefa.concluido ? 'line-through' : 'none'">
                              {{ tarefa.titulo }}
                            </h3>
                            @if (tarefa.descricao) {
                              <p class="is-size-6 has-text-grey mt-1">
                                {{ tarefa.descricao }}
                              </p>
                            }
                          </div>
                        }
                      </div>

                      <div class="column is-narrow-tablet is-full-mobile">
                        <div class="buttons is-right are-small">
                          @if (tarefaEditando() === tarefa.id) {
                            <button class="button is-success" (click)="salvarEdicao(tarefa)">
                              <span>Salvar</span>
                            </button>
                            <button class="button is-light" (click)="cancelarEdicao()">
                              <span>Cancelar</span>
                            </button>
                          } @else {
                            <button class="button is-info is-light" (click)="iniciarEdicao(tarefa)">
                              <span>Editar</span>
                            </button>
                            <button class="button is-danger is-light" (click)="deleteTarefa(tarefa.id)">
                              <span>Remover</span>
                            </button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="notification is-light has-text-centered mt-4">
                  <p>Nenhuma tarefa encontrada. Que tal adicionar uma?</p>
                </div>
              }
            </div>
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .is-concluida {
      background-color: #fcfcfc;
      border-left: 5px solid #00d1b2;
    }
    .card {
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border-radius: 8px;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.1);
    }
    @media screen and (max-width: 768px) {
      .column.is-full-mobile {
        padding-top: 0;
      }
    }
  `],
})
export class App implements OnInit {
  private http = inject(HttpClient);
  // @ts-ignore
  private apiUrl = `http://localhost:${process.env.PORTA_SERVIDOR || '8085'}/tarefas`;

  tarefas = signal<Tarefa[]>([]);
  novoTitulo = signal('');
  novaDescricao = signal('');
  
  tarefaEditando = signal<number | null>(null);
  tituloEditando = signal('');
  descricaoEditando = signal('');

  // Auth
  usuarioLogado = signal<{username: string, deve_mudar_senha: boolean} | null>(null);
  usernameInput = signal('');
  passwordInput = signal('');
  novaSenhaInput = signal('');
  loginErro = signal('');

  // Propriedades Computadas
  totalTarefas = computed(() => this.tarefas().length);
  tarefasConcluidas = computed(() => this.tarefas().filter(t => t.concluido).length);
  tarefasPendentes = computed(() => this.totalTarefas() - this.tarefasConcluidas());

  ngOnInit() {
    // Tenta carregar tarefas para ver se está logado
    this.carregarTarefas();
  }

  login() {
    this.http.post<{usuario: any}>(`${this.apiUrl.replace('/tarefas', '')}/login`, {
      username: this.usernameInput(),
      password: this.passwordInput()
    }).subscribe({
      next: (res) => {
        this.usuarioLogado.set(res.usuario);
        this.loginErro.set('');
        if (!res.usuario.deve_mudar_senha) {
          this.carregarTarefas();
        }
      },
      error: (err) => {
        this.loginErro.set(err.error?.message || 'Erro ao fazer login');
      }
    });
  }

  mudarSenha() {
    this.http.post(`${this.apiUrl.replace('/tarefas', '')}/mudar-senha`, {
      novaSenha: this.novaSenhaInput()
    }).subscribe({
      next: () => {
        alert('Senha alterada! Faça login novamente.');
        this.logout();
      },
      error: (err) => alert(err.error?.message || 'Erro ao mudar senha')
    });
  }

  logout() {
    this.http.post(`${this.apiUrl.replace('/tarefas', '')}/logout`, {}).subscribe(() => {
      this.usuarioLogado.set(null);
      this.tarefas.set([]);
      this.usernameInput.set('');
      this.passwordInput.set('');
      this.novaSenhaInput.set('');
    });
  }

  carregarTarefas() {
    this.http.get<Tarefa[]>(this.apiUrl).subscribe({
      next: (data) => {
        this.tarefas.set(data);
        // Se carregou com sucesso, assume que está logado (simplificação para este exemplo)
        if (!this.usuarioLogado()) {
           // Em um app real, você teria um endpoint /me para validar a sessão
        }
      },
      error: (err) => {
        if (err.status === 401) this.usuarioLogado.set(null);
      }
    });
  }

  addTarefa() {
    if (!this.novoTitulo()) return;

    this.http.post<{message: string, tarefa: Tarefa}>(this.apiUrl, {
      titulo: this.novoTitulo(),
      descricao: this.novaDescricao()
    }).subscribe(res => {
      this.tarefas.update(current => [...current, res.tarefa]);
      this.novoTitulo.set('');
      this.novaDescricao.set('');
    });
  }

  toggleTarefa(tarefa: Tarefa) {
    const endpoint = tarefa.concluido ? 'uncomplete' : 'complete';
    this.http.patch<{message: string, tarefa: Tarefa}>(`${this.apiUrl}/${tarefa.id}/${endpoint}`, {}).subscribe(res => {
      this.tarefas.update(current => 
        current.map(t => t.id === tarefa.id ? res.tarefa : t)
      );
    });
  }

  deleteTarefa(id: number) {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe(() => {
      this.tarefas.update(current => current.filter(t => t.id !== id));
    });
  }

  iniciarEdicao(tarefa: Tarefa) {
    this.tarefaEditando.set(tarefa.id);
    this.tituloEditando.set(tarefa.titulo);
    this.descricaoEditando.set(tarefa.descricao || '');
  }

  cancelarEdicao() {
    this.tarefaEditando.set(null);
    this.tituloEditando.set('');
    this.descricaoEditando.set('');
  }

  salvarEdicao(tarefa: Tarefa) {
    if (!this.tituloEditando().trim()) return;

    this.http.put<{message: string, tarefa: Tarefa}>(`${this.apiUrl}/${tarefa.id}`, {
      ...tarefa,
      titulo: this.tituloEditando(),
      descricao: this.descricaoEditando()
    }).subscribe(res => {
      this.tarefas.update(current => 
        current.map(t => t.id === tarefa.id ? res.tarefa : t)
      );
      this.cancelarEdicao();
    });
  }
}
