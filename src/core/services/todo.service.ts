import { Injectable } from '@angular/core'
import { CommentModel, TodoModel, TodoStatus } from '../models/todo.model'

@Injectable({ providedIn: 'root' })
export class TodoService {
  private nextId = 2
  private nextCommentId = 1
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
      comments: [],
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

  getComments(todoId: number): CommentModel[] {
    const todo = this.getTodoById(todoId)
    if (!todo) return []
    return [...todo.comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }

  addComment(todoId: number, text: string): CommentModel | undefined {
    const todo = this.getTodoById(todoId)
    if (!todo) return undefined
    const trimmed = text.trim()
    if (!trimmed) return undefined
    const comment: CommentModel = {
      id: this.nextCommentId++,
      todoId,
      text: trimmed,
      createdAt: new Date(),
    }
    todo.comments = [...todo.comments, comment]
    return comment
  }

  deleteComment(todoId: number, commentId: number): void {
    const todo = this.getTodoById(todoId)
    if (!todo) return
    todo.comments = todo.comments.filter((c) => c.id !== commentId)
  }
}
