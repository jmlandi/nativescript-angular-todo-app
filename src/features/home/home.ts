import { Component, NO_ERRORS_SCHEMA, ViewContainerRef, inject } from '@angular/core'
import { ItemEventData, TouchGestureEventData, View } from '@nativescript/core'
import {
  NativeScriptCommonModule,
  RouterExtensions,
  ModalDialogService,
  ModalDialogOptions,
} from '@nativescript/angular'
import { TodoService } from '../../core/services/todo.service'
import { TodoModel } from '../../core/models/todo.model'
import { FormatStatusPipe } from '../../core/pipes/format-status.pipe'
import { TodoForm, TodoFormResult } from './todo-form/todo-form'

@Component({
  selector: 'ns-home',
  templateUrl: './home.html',
  imports: [NativeScriptCommonModule, FormatStatusPipe],
  schemas: [NO_ERRORS_SCHEMA],
})
export class Home {
  private todoService = inject(TodoService)
  private router = inject(RouterExtensions)
  private modal = inject(ModalDialogService)
  private vcRef = inject(ViewContainerRef)

  get todos(): TodoModel[] {
    return this.todoService.getTodos()
  }

  onItemTap(event: ItemEventData): void {
    const todo = this.todos[event.index]
    this.router.navigate(['/details', todo.id])
  }

  onAdd(): void {
    this.showForm()
  }

  getStatusClass(status: string): string {
    return 'todo-status status-' + status.toLowerCase()
  }

  onCardLoaded(event: { object: View }): void {
    const view = event.object
    view.opacity = 0
    view.translateY = 18
    view.animate({
      opacity: 1,
      translate: { x: 0, y: 0 },
      duration: 320,
      curve: 'easeOut',
    })
  }

  onCtaTouch(event: TouchGestureEventData): void {
    const view = event.object as View
    if (event.action === 'down') {
      view.animate({ scale: { x: 0.96, y: 0.96 }, duration: 90, curve: 'easeOut' })
    } else if (event.action === 'up' || event.action === 'cancel') {
      view.animate({ scale: { x: 1, y: 1 }, duration: 140, curve: 'easeOut' })
    }
  }

  showForm(): void {
    const options: ModalDialogOptions = {
      viewContainerRef: this.vcRef,
      fullscreen: true,
    }
    this.modal.showModal(TodoForm, options).then((result: TodoFormResult | null) => {
      if (!result) return
      this.todoService.addTodo(result.title, result.description, result.status)
    })
  }
}
