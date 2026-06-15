import { Injectable } from '@angular/core'
import { TodoModel, TodoStatus } from '../models/todo.model'

@Injectable({ providedIn: 'root' })
export class TodoService {
  private nextId = 2
  private todos: TodoModel[] = []

  getTodos(): TodoModel[] {
    return this.todos
  }

  getTodoById(id: number): TodoModel | undefined {
    return this.todos.find((todo) => todo.id === id)
  }

  addTodo(title: string, description = '', status: TodoStatus = TodoStatus.Pending): TodoModel {
    const todo: TodoModel = {
      id: this.nextId++,
      title,
      description,
      status,
      createdAt: new Date(),
    }
    this.todos = [...this.todos, todo]
    return todo
  }

  updateTodo(id: number, changes: Partial<Pick<TodoModel, 'title' | 'description' | 'status'>>): void {
    const todo = this.getTodoById(id)
    if (todo) Object.assign(todo, changes)
  }

  deleteTodo(id: number): void {
    this.todos = this.todos.filter((todo) => todo.id !== id)
  }
}
