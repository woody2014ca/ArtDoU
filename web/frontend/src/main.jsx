import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

// 二级路径：ArtDoU 挂在 /artdou，根域名 www.kunlunfo.com 可做其他首页
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
