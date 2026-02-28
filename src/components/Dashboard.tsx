import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="auth-card">
      <h1>Welcome, {user?.username}</h1>
      <p className="auth-subtitle">You are logged in.</p>
      <button onClick={logout} className="auth-btn auth-btn--secondary">
        Sign out
      </button>
    </div>
  );
}
