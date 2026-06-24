import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import BabySetupPage from './pages/BabySetupPage';
import ProjectPage from './pages/ProjectPage';
import PeriodSelectPage from './pages/PeriodSelectPage';
import VideoGeneratePage from './pages/VideoGeneratePage';
import HistoryPage from './pages/HistoryPage';
import CreateProjectPage from './pages/CreateProjectPage';
import { initDatabase } from './utils/tauriCommands';

function App() {
  useEffect(() => {
    // 初始化数据库
    initDatabase().catch(console.error);
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="baby-setup" element={<BabySetupPage />} />
        <Route path="create-project" element={<CreateProjectPage />} />
        <Route path="project/:projectId" element={<ProjectPage />}>
          <Route index element={<Navigate to="periods" replace />} />
          <Route path="periods" element={<PeriodSelectPage />} />
          <Route path="generate" element={<VideoGeneratePage />} />
          <Route path="history" element={<HistoryPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
