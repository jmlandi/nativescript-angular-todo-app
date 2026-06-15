import { Component, NgZone, NO_ERRORS_SCHEMA, inject } from '@angular/core'
import {
  NativeScriptCommonModule,
  NativeScriptFormsModule,
  ModalDialogParams,
} from '@nativescript/angular'
import { TodoStatus } from '../../../core/models/todo.model'
import { FormatStatusPipe } from '../../../core/pipes/format-status.pipe'

export interface TodoFormResult {
  title: string
  description: string
  status: TodoStatus
}

@Component({
  selector: 'ns-todo-form',
  templateUrl: './todo-form.html',
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, FormatStatusPipe],
  schemas: [NO_ERRORS_SCHEMA],
})
export class TodoForm {
  private params = inject(ModalDialogParams)
  private zone = inject(NgZone)

  title = ''
  description = ''
  status: TodoStatus = TodoStatus.Pending
  readonly statusOptions = Object.values(TodoStatus)

  get canSubmit(): boolean {
    return this.title.trim().length > 0
  }

  setStatus(status: TodoStatus): void {
    this.zone.run(() => {
      this.status = status
    })
  }

  isActiveStatus(status: TodoStatus): boolean {
    return this.status === status
  }

  trackByStatus(_index: number, status: TodoStatus): string {
    return status
  }

  submit(): void {
    if (!this.canSubmit) return
    const result: TodoFormResult = {
      title: this.title.trim(),
      description: this.description.trim(),
      status: this.status,
    }
    this.params.closeCallback(result)
  }

  cancel(): void {
    this.params.closeCallback(null)
  }
}
