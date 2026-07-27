import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {I18nProvider, detectLocale} from './i18n/context';
import './index.css';

// `lang` posé avant le premier rendu : il gouverne la césure, la synthèse vocale
// et la traduction automatique du navigateur.
document.documentElement.lang = detectLocale();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
