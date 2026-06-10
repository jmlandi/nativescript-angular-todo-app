import { Component, NO_ERRORS_SCHEMA, OnInit, inject } from '@angular/core'
import { NativeScriptCommonModule, PageRoute, RouterExtensions } from '@nativescript/angular'
import { switchMap } from 'rxjs'
import { TodoModel, TodoStatus } from '../../core/models/todo.model'
import { TodoService } from '../../core/services/todo.service'

@Component({
  selector: 'ns-details',
  templateUrl: './details.html',
  imports: [NativeScriptCommonModule],
  schemas: [NO_ERRORS_SCHEMA],
})
export class Details implements OnInit {
  private todoService = inject(TodoService)
  private pageRoute = inject(PageRoute)
  private router = inject(RouterExtensions)

  todo: TodoModel | undefined
  readonly statusOptions = Object.values(TodoStatus)

  ngOnInit(): void {
    this.pageRoute.activatedRoute
      .pipe(switchMap((route) => route.params))
      .subscribe((params) => {
        this.todo = this.todoService.getTodoById(+params['id'])
      })
  }

  setStatus(status: TodoStatus): void {
    if (!this.todo) return
    this.todoService.updateTodo(this.todo.id, { status })
    this.todo = { ...this.todo, status }
  }

  deleteTodo(): void {
    if (!this.todo) return
    this.todoService.deleteTodo(this.todo.id)
    this.router.back()
  }

  getStatusClass(status: string): string {
    return 'todo-status status-' + status.toLowerCase()
  }

  isActiveStatus(status: TodoStatus): boolean {
    return this.todo?.status === status
  }
}
