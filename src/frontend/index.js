import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './yjs_game/App'

const rootElement = document.getElementById('app-root');
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);