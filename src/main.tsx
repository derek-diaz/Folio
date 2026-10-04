import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import { applyTheme, readTheme } from './core/theme';

applyTheme(readTheme());
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
