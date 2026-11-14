import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import App from './App.js';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('theme') === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

