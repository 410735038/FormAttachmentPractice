import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { store } from './store/store';
import { AttachmentFileProvider } from './store/AttachmentFileProvider';
import App from './App';
import './styles.css';

ModuleRegistry.registerModules([AllCommunityModule]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <AttachmentFileProvider>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: '#0f766e',
              borderRadius: 6,
              fontFamily:
                'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            },
          }}
        >
          <App />
        </ConfigProvider>
      </AttachmentFileProvider>
    </Provider>
  </React.StrictMode>,
);
