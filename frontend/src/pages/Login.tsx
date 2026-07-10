import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User as UserIcon, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/Button';
import { UserRole } from '../types';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('••••••••');
  const [selectedRole, setSelectedRole] = useState<UserRole>('Super Admin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const success = await login(username, selectedRole);
      if (success) {
        navigate('/dashboard');
      } else {
        setError('Invalid username or password credentials.');
      }
    } catch (err) {
      setError('An error occurred during authentication.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoAccountSelect = (role: UserRole) => {
    setSelectedRole(role);
    if (role === 'Super Admin') {
      setUsername('admin');
    } else if (role === 'Network Administrator') {
      setUsername('netadmin');
    } else if (role === 'Network Engineer') {
      setUsername('engineer');
    }
    setPassword('admin123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 relative overflow-hidden px-4">
      {/* Background blobs for premium glassmorphism effect */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="w-full max-w-md z-10 space-y-8">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-tr from-blue-500 to-cyan-400 items-center justify-center font-bold text-white shadow-xl text-2xl mb-4">
            CN
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-400">
            CampusNet AI
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            AI-Powered Campus Network & Wireless Controller
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs p-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Username
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-10 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-10 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            {/* Quick Demo Selector */}
            <div className="pt-2 border-t border-slate-700/50">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                <span>Select Demo Controller Role</span>
                <span className="inline-flex items-center text-slate-500 hover:text-slate-300 cursor-help" title="Switching roles simulates JWT claims restrictiveness on front/back modules.">
                  <HelpCircle className="h-3 w-3" />
                </span>
              </span>
              <div className="grid grid-cols-1 gap-2">
                {(['Super Admin', 'Network Administrator', 'Network Engineer'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleDemoAccountSelect(r)}
                    className={`px-3 py-1.5 rounded text-xs font-medium border text-center transition-colors cursor-pointer ${
                      selectedRole === r
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isSubmitting}
              className="w-full py-2.5 font-semibold text-sm bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 border-0 mt-6"
            >
              Access Controller
            </Button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-500">
          <p>© 2026 CampusNet AI Systems, Inc.</p>
          <p className="mt-1 flex items-center justify-center space-x-1">
            <Shield className="h-3.5 w-3.5 text-cyan-500" />
            <span>FIPS 140-2 Compliant Encryption Active</span>
          </p>
        </div>
      </div>
    </div>
  );
};
export default Login;
