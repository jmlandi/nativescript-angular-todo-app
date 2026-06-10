import { Component, NO_ERRORS_SCHEMA, inject } from '@angular/core'
import { ItemEventData } from '@nativescript/core'
import { NativeScriptCommonModule, RouterExtensions } from '@nativescript/angular'
import { TodoService } from '../../core/services/todo.service'
import { TodoModel } from '../../core/models/todo.model'

@Component({
  selector: 'ns-home',
  templateUrl: './home.html',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
})
export class Home {
  private todoService = inject(TodoService)
  private router = inject(RouterExtensions)

  get todos(): TodoModel[] {
    return this.todoService.getTodos()
  }

  onItemTap(event: ItemEventData): void {
    const todo = this.todos[event.index]
    this.router.navigate(['/details', todo.id])
  }

  onAdd(): void {
    const n = this.todos.length + 1
    this.todoService.addTodo(`Task ${n}`)
  }

  getStatusClass(status: string): string {
    return 'todo-status status-' + status.toLowerCase()
  }
}
