import React from 'react';
import { createRoot } from 'react-dom/client';
import '@nexus-font';
import '../styles.css';
import { initStore } from '../lib/store';
import { Popup } from './Popup';

initStore();
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
