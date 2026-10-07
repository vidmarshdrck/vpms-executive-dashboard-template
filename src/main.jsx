import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import '@fontsource-variable/outfit'
import '@fontsource-variable/inter-tight'
import './index.css'

// This client's IIS server allows no URL Rewrite / server-side rewrite rules
// (see IIS_DEPLOY notes) — BrowserRouter needs the server to hand any deep
// link (e.g. /executive) back to index.html, which URL Rewrite would
// normally do. HashRouter needs no server cooperation at all: every request
// IIS ever sees is for index.html itself, and routing after the "#" is
// handled entirely in the browser. GitHub Pages keeps BrowserRouter (its own
// 404.html redirect trick already avoids needing a server rewrite there).
const Router = import.meta.env.VITE_ROUTER === 'hash' ? HashRouter : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router basename={import.meta.env.VITE_ROUTER === 'hash' ? undefined : import.meta.env.BASE_URL}><AuthProvider><App /></AuthProvider></Router>
  </React.StrictMode>
)
