import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AuthScreen from './pages/AuthScreen';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import FormacaoPreco from './pages/FormacaoPreco';
import CustoFixo from './pages/CustoFixo';
import CustosVariaveis from './pages/CustosVariaveis';
import SimuladorImpostos from './pages/SimuladorImpostos';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import AdminPanel from './pages/AdminPanel';
import Pricing from './pages/Pricing';
import { useAppContext } from './context/AppContext';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isGuest } = useAppContext();
  
  if (!user && !isGuest) {
    return <Navigate to="/auth" />;
  }
  
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/auth" element={<AuthScreen />} />
        <Route path="/verify" element={<VerifyEmail />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/planos" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
        <Route path="/formacao-preco" element={<ProtectedRoute><FormacaoPreco /></ProtectedRoute>} />
        <Route path="/custos-fixos" element={<ProtectedRoute><CustoFixo /></ProtectedRoute>} />
        <Route path="/custos-variaveis" element={<ProtectedRoute><CustosVariaveis /></ProtectedRoute>} />
        <Route path="/impostos" element={<ProtectedRoute><SimuladorImpostos /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
        {/* Catch-all */}
        <Route path="*" element={<ProtectedRoute><div>Em desenvolvimento...</div></ProtectedRoute>} />
      </Routes>
    </Router>
  );
}
