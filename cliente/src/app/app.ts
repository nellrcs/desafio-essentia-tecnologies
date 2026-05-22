import { Component, signal, inject, OnInit } from '@angular/core';
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

          <div class="field has-addons mb-5">
            <div class="control is-expanded">
              <input 
                class="input is-primary"
                type="text" 
                [(ngModel)]="novoTitulo" 
                placeholder="O que precisa ser feito?"
                (keyup.enter)="addTarefa()"
              >
            </div>
            <div class="control">
              <button 
                class="button is-primary" 
                (click)="addTarefa()" 
                [disabled]="!novoTitulo()"
              >
                <strong>Adicionar</strong>
              </button>
            </div>
          </div>

          <div class="tarefa-list">
            @for (tarefa of tarefas(); track tarefa.id) {
              <div class="card mb-3" [class.is-concluida]="tarefa.concluido">
                <div class="card-content py-3 px-4">
                  <div class="level is-mobile">
                    <div class="level-left is-flex-grow-1">
                      <div class="level-item mr-3">
                        <label class="checkbox">
                          <input 
                            type="checkbox" 
                            [checked]="tarefa.concluido" 
                            (change)="toggleTarefa(tarefa)"
                            [disabled]="tarefaEditando() === tarefa.id"
                          >
                        </label>
                      </div>
                      
                      <div class="level-item is-flex-grow-1" style="justify-content: flex-start;">
                        @if (tarefaEditando() === tarefa.id) {
                          <div class="field is-grouped is-flex-grow-1">
                            <div class="control is-expanded">
                              <input 
                                class="input is-small is-info"
                                type="text" 
                                [(ngModel)]="tituloEditando" 
                                (keyup.enter)="salvarEdicao(tarefa)"
                                (keyup.escape)="cancelarEdicao()"
                                autoFocus
                              >
                            </div>
                          </div>
                        } @else {
                          <span class="is-size-5 titulo-texto" [style.text-decoration]="tarefa.concluido ? 'line-through' : 'none'" [style.color]="tarefa.concluido ? '#aaa' : 'inherit'">
                            {{ tarefa.titulo }}
                          </span>
                        }
                      </div>
                    </div>

                    <div class="level-right">
                      <div class="level-item">
                        <div class="buttons are-small">
                          @if (tarefaEditando() === tarefa.id) {
                            <button class="button is-success is-light" (click)="salvarEdicao(tarefa)">
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
      background-color: #f9f9f9;
      border-left: 4px solid #dbdbdb;
    }
    .card {
      transition: all 0.2s ease;
    }
    .card:hover {
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    .titulo-texto {
      word-break: break-all;
    }
  `],
})
export class App implements OnInit {
  private http = inject(HttpClient);
  // @ts-ignore
  private apiUrl = `http://localhost:${process.env.PORTA_SERVIDOR || '8085'}/tarefas`;

  tarefas = signal<Tarefa[]>([]);
  novoTitulo = signal('');
  
  tarefaEditando = signal<number | null>(null);
  tituloEditando = signal('');

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
      descricao: ''
    }).subscribe(res => {
      this.tarefas.update(current => [...current, res.tarefa]);
      this.novoTitulo.set('');
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
  }

  cancelarEdicao() {
    this.tarefaEditando.set(null);
    this.tituloEditando.set('');
  }

  salvarEdicao(tarefa: Tarefa) {
    if (!this.tituloEditando().trim()) return;

    this.http.put<{message: string, tarefa: Tarefa}>(`${this.apiUrl}/${tarefa.id}`, {
      ...tarefa,
      titulo: this.tituloEditando()
    }).subscribe(res => {
      this.tarefas.update(current => 
        current.map(t => t.id === tarefa.id ? res.tarefa : t)
      );
      this.cancelarEdicao();
    });
  }
}
