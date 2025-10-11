import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from './components/Dashboard';
import { ScheduledListingsPage } from './pages/ScheduledListingsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/scheduled" element={<ScheduledListingsPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
