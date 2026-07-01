import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function RoleProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="mx-auto max-w-6xl px-4 py-16">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/profile" replace />;
  return children;
}
