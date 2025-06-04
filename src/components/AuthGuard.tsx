import { useEffect } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, intendedRedirectPath, setIntendedRedirectPath } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && intendedRedirectPath && intendedRedirectPath !== location.pathname) {
      setIntendedRedirectPath(null);
      navigate(intendedRedirectPath, { replace: true });
    }
  }, [loading, user, intendedRedirectPath, location.pathname, navigate, setIntendedRedirectPath]);

  if (loading) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-white rounded-full border-t-transparent"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}