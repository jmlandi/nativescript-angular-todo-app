import { Pipe, PipeTransform } from '@angular/core'

@Pipe({ name: 'formatStatus', standalone: true })
export class FormatStatusPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return ''
    return value.toLowerCase().replace(/_/g, ' ')
  }
}
