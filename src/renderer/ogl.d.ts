import type { OglApi } from '../shared/api'

declare global {
  interface Window {
    ogl: OglApi
  }
}

export {}
