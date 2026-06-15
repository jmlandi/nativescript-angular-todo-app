import { Component, NgZone, NO_ERRORS_SCHEMA, OnInit, inject } from '@angular/core'
import {
  NativeScriptCommonModule,
  NativeScriptFormsModule,
  PageRoute,
  RouterExtensions,
} from '@nativescript/angular'
import { confirm } from '@nativescript/core/ui/dialogs'
import { switchMap } from 'rxjs'
import { CommentModel, TodoModel, TodoStatus } from '../../core/models/todo.model'
import { TodoService } from '../../core/services/todo.service'
import { FormatStatusPipe } from '../../core/pipes/format-status.pipe'

@Component({
  selector: 'ns-details',
  templateUrl: './details.html',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, FormatStatusPipe],
  schemas: [NO_ERRORS_SCHEMA],
})
export class Details implements OnInit {
  private todoService = inject(TodoService)
  private pageRoute = inject(PageRoute)
  private router = inject(RouterExtensions)
  private zone = inject(NgZone)

  todo: TodoModel | undefined
  original: TodoModel | undefined
  pendingStatus: TodoStatus | undefined
  newComment = ''
  readonly statusOptions = Object.values(TodoStatus)

  ngOnInit(): void {
    this.pageRoute.activatedRoute
      .pipe(switchMap((route) => route.params))
      .subscribe((params) => {
        const found = this.todoService.getTodoById(+params['id'])
        this.todo = found
        this.original = found ? { ...found } : undefined
        this.pendingStatus = found?.status
      })
  }

  setStatus(status: TodoStatus): void {
    if (!this.todo) return
    this.zone.run(() => {
      this.pendingStatus = status
    })
  }

  isActiveStatus(status: TodoStatus): boolean {
    return this.pendingStatus === status
  }

  get isDirty(): boolean {
    return !!this.original && this.pendingStatus !== this.original.status
  }

  get canSave(): boolean {
    return this.isDirty
  }

  get comments(): CommentModel[] {
    return this.todo ? this.todoService.getComments(this.todo.id) : []
  }

  get canAddComment(): boolean {
    return this.newComment.trim().length > 0
  }

  addComment(): void {
    if (!this.todo || !this.canAddComment) return
    this.zone.run(() => {
      this.todoService.addComment(this.todo!.id, this.newComment)
      this.newComment = ''
    })
  }

  removeComment(commentId: number): void {
    if (!this.todo) return
    this.zone.run(() => {
      this.todoService.deleteComment(this.todo!.id, commentId)
    })
  }

  save(): void {
    if (!this.todo || !this.isDirty || !this.pendingStatus) return
    this.zone.run(() => {
      this.todoService.updateTodo(this.todo!.id, { status: this.pendingStatus! })
      this.todo = { ...this.todo!, status: this.pendingStatus! }
      this.original = { ...this.todo }
    })
  }

  async onBack(): Promise<void> {
    if (!this.isDirty) {
      this.router.back()
      return
    }
    const summary = this.buildDiffSummary()
    const proceed = await confirm({
      title: 'unsaved changes',
      message: `you edited:\n${summary}\n\nleave without saving?`,
      okButtonText: 'discard',
      cancelButtonText: 'stay',
    })
    if (proceed) {
      this.zone.run(() => this.router.back())
    }
  }

  deleteTodo(): void {
    if (!this.todo) return
    this.todoService.deleteTodo(this.todo.id)
    this.router.back()
  }

  getStatusClass(status: string): string {
    return 'todo-status status-' + status.toLowerCase()
  }

  private buildDiffSummary(): string {
    if (!this.original) return ''
    const lines: string[] = []
    if (this.pendingStatus && this.pendingStatus !== this.original.status) {
      lines.push(`• status: ${this.original.status} → ${this.pendingStatus}`)
    }
    return lines.join('\n')
  }
}
