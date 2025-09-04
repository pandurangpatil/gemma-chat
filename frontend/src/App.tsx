import { Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';

function App() {
  return (
    <div className="flex h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Sidebar />
      <Routes>
        <Route path="/" element={<ChatView />} />
        <Route path="/threads/:threadId" element={<ChatView />} />
      </Routes>
    </div>
  );
}

export default App;
