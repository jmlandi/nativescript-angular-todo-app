import { Component, NO_ERRORS_SCHEMA } from '@angular/core'
import { NativeScriptCommonModule, PageRouterOutlet } from '@nativescript/angular'

@Component({
  selector: 'ns-app',
  template: '<page-router-outlet></page-router-outlet>',
  imports: [NativeScriptCommonModule, PageRouterOutlet],
  schemas: [NO_ERRORS_SCHEMA]
})
export class AppComponent {}
