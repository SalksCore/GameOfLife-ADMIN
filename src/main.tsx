import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { SessionProvider } from './lib/session';
import './styles.css';
import './styles-pages.css';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/dm-sans';
import './screen.css';
import './regie.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
