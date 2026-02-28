import { AuthProvider, useAuth } from './context/AuthContext';
import LoginForm from './components/LoginForm';
import Dashboard from './components/Dashboard';
import './App.css';

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div className="auth-loading">Loading…</div>;
  }

  return user ? <Dashboard /> : <LoginForm />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
