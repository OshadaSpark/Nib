import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

const target = document.getElementById('app')

if (!target) {
  throw new Error('Mount target "#app" was not found in index.html')
}

mount(App, { target })

// Caches the app for offline use, and makes it installable. Not in development, where the files
// change with every edit.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
}
