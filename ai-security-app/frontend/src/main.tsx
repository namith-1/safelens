// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/context/AuthContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#162030',
              color: '#e2e8f0',
              border: '1px solid #1e3a5f',
              fontSize: '14px',
            },
            success: { iconTheme: { primary: '#10b981', secondary: '#162030' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: '#162030' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
