import { BrowserRouter, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import PortalRoutes from './routes/PortalRoutes';
import { ToastProvider } from './components/ui/ToastProvider';
import { getSession } from './services/session';

/** Map route prefixes to page titles for SEO & UX */
function MainContent() {
  const location = useLocation();
  const session = getSession();

  useEffect(() => {
    document.title = 'Chuỗi GYM | Igen ERP';
  }, [location.pathname]);

  if (!session) return null;
  return <div className="App"><main><PortalRoutes session={session} /></main></div>;
}

function App() {
  return (
    <BrowserRouter basename="/chuoi-gym">
      <ToastProvider><MainContent /></ToastProvider>
    </BrowserRouter>
  );
}

export default App;
