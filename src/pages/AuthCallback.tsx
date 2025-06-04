import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../supabaseClient";
import { getUserProfile } from "../services/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Obtener datos de la redirección de OAuth
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          console.error("Error en el callback de autenticación:", error.message);
          setError(error.message);
          setTimeout(() => navigate("/login"), 3000);
          return;
        }

        if (data?.session?.user) {
          const userId = data.session.user.id;

          try {
            const { success, profile } = await getUserProfile(userId);

            if (success && profile) {
              navigate("/home");
            } else {
              navigate("/profile");
            }
          } catch (profileError) {
            console.error("Error al verificar perfil:", profileError);
            navigate("/profile");
          }
        } else {
          // No hay sesión, redirigir al login
          navigate("/login");
        }
      } catch (err) {
        console.error("Error inesperado en callback:", err);
        setError("Ocurrió un error inesperado");
        setTimeout(() => navigate("/login"), 3000);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  return (
    <div className="gradient-bg min-h-screen flex flex-col items-center justify-center p-6">
      <div className="glass-card p-8 w-full max-w-md text-center">
        {error ? (
          <>
            <h2 className="text-2xl font-bold text-white mb-4">Error de autenticación</h2>
            <p className="text-white/80 mb-4">{error}</p>
            <p className="text-white/60">Redirigiendo al inicio de sesión...</p>
          </>
        ) : (
          <>
            <div className="animate-spin h-12 w-12 border-4 border-white rounded-full border-t-transparent mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-white mb-4">Autenticando...</h2>
            <p className="text-white/80">Estamos verificando tu información</p>
          </>
        )}
      </div>
    </div>
  );
} 