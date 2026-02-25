import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { BatchAnalyzerPage } from './pages/BatchAnalyzerPage';
import { WebAnalyzerPage } from './pages/WebAnalyzerPage';
import { ImageAnalyzerPage } from './pages/ImageAnalyzerPage';
import { SettingsPage } from './pages/SettingsPage';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<BatchAnalyzerPage mode="pdf" />} />
          <Route path="/video" element={<BatchAnalyzerPage mode="video" />} />
          <Route path="/web" element={<WebAnalyzerPage />} />
          <Route path="/image" element={<ImageAnalyzerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;