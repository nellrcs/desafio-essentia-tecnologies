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
    <div class="container">
      <h1>Minhas Tarefas</h1>

      <div class="add-tarefa">
        <input 
          type="text" 
          [(ngModel)]="novoTitulo" 
          placeholder="O que precisa ser feito?"
          (keyup.enter)="addTarefa()"
        >
        <button (click)="addTarefa()" [disabled]="!novoTitulo()">Adicionar</button>
      </div>

      <ul class="tarefa-list">
        @for (tarefa of tarefas(); track tarefa.id) {
          <li class="tarefa-item" [class.concluida]="tarefa.concluido">
            <input 
              type="checkbox" 
              [checked]="tarefa.concluido" 
              (change)="toggleTarefa(tarefa)"
            >
            <span class="titulo">{{ tarefa.titulo }}</span>
            <button class="btn-delete" (click)="deleteTarefa(tarefa.id)">Remover</button>
          </li>
        } @empty {
          <p>Nenhuma tarefa encontrada.</p>
        }
      </ul>
    </div>
  `,
  styles: [`
    .container {
      max-width: 600px;
      margin: 2rem auto;
      padding: 1rem;
      font-family: sans-serif;
    }
    .add-tarefa {
      display: flex;
      gap: 10px;
      margin-bottom: 2rem;
    }
    .add-tarefa input {
      flex: 1;
      padding: 8px;
      font-size: 1rem;
    }
    .tarefa-list {
      list-style: none;
      padding: 0;
    }
    .tarefa-item {
      display: flex;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid #eee;
      gap: 10px;
    }
    .tarefa-item.concluida .titulo {
      text-decoration: line-through;
      color: #888;
    }
    .titulo {
      flex: 1;
    }
    .btn-delete {
      background: #ff4444;
      color: white;
      border: none;
      padding: 5px 10px;
      cursor: pointer;
      border-radius: 4px;
    }
    .btn-delete:hover {
      background: #cc0000;
    }
  `],
})
export class App implements OnInit {
  private http = inject(HttpClient);
  // @ts-ignore
  private apiUrl = `http://localhost:${process.env.PORTA_SERVIDOR || '8085'}/tarefas`;

  tarefas = signal<Tarefa[]>([]);
  novoTitulo = signal('');

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
}
