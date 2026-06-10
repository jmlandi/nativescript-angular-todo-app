import {
  bootstrapApplication,
  provideNativeScriptRouter,
  runNativeScriptAngularApp,
} from '@nativescript/angular'
import { AppComponent } from './app.component'
import { routes } from './routes'

runNativeScriptAngularApp({
  appModuleBootstrap: () =>
    bootstrapApplication(AppComponent, {
      providers: [provideNativeScriptRouter(routes)],
    }),
})
