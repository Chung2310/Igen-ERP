import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { getSession } from '../services/session';
export default function ProtectedRoute({ children }: { children: ReactNode }) { return getSession() ? children : <Navigate to="/login" replace />; }
