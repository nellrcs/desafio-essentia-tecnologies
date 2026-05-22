import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Tarefa {
  id: number;
  titulo: string;
  descricao: string;
  concluido: boolean;
  dataCriacao: Date;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="section">
      <div class="container" style="max-width: 800px;">
        <div class="box">
          <h1 class="title has-text-centered has-text-primary">Minhas Tarefas</h1>

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
                    <!-- Checkbox e Título/Descrição -->
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

                    <!-- Botões de Ação -->
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

  // Propriedades Computadas
  totalTarefas = computed(() => this.tarefas().length);
  tarefasConcluidas = computed(() => this.tarefas().filter(t => t.concluido).length);
  tarefasPendentes = computed(() => this.totalTarefas() - this.tarefasConcluidas());

  ngOnInit() {
    this.carregarTarefas();
  }

  carregarTarefas() {
    this.http.get<Tarefa[]>(this.apiUrl).subscribe(data => {
      this.tarefas.set(data);
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
