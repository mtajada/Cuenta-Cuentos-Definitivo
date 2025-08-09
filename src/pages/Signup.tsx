import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageTransition from "../components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import BackButton from "../components/BackButton";
import { signInWithGoogle } from "../supabaseAuth";

export default function Signup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  

  
  const handleGoogleSignup = async () => {
    try {
      setIsGoogleLoading(true);
      const { error } = await signInWithGoogle();
      
      if (error) {
        toast({
          title: "Error al registrarse con Google",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error al registrarse con Google",
        variant: "destructive"
      });
      console.error(err);
    } finally {
      setIsGoogleLoading(false);
    }
  };
  
  const togglePasswordVisibility = () => setShowPassword(!showPassword);
  const toggleConfirmPasswordVisibility = () => setShowConfirmPassword(!showConfirmPassword);
  
  return (
    <PageTransition>
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{
          backgroundImage: 'url(/fondo_png.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute top-4 left-4 z-10">
          <BackButton />
        </div>
        
        <div className="w-full max-w-md bg-white/70 rounded-3xl p-8 shadow-lg border border-[#BB79D1]/20">
          <div className="flex justify-center mb-6">
            <img src="/logo_png.png" alt="TaleMe Logo" className="w-48 max-w-full" />
          </div>
          
          <h1 className="text-3xl font-bold text-[#222] mb-6 text-center">
            Crear Cuenta
          </h1>
          
          <p className="text-[#555] text-center mb-8 text-sm">
            Para crear tu cuenta en TaleMe, usa tu cuenta de Google. Es rápido, seguro y fácil.
          </p>
          
          <div className="space-y-4">
              
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-2 bg-white text-[#333] rounded-xl py-3 hover:bg-gray-100 transition-colors duration-300 border border-[#BB79D1]/20 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                {isGoogleLoading ? "Conectando..." : "Continuar con Google"}
              </button>
              
              <div className="text-center mt-5">
                <span className="text-[#555] text-sm">¿Ya tienes una cuenta? </span>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-[#BB79D1] font-semibold text-sm hover:underline"
                >
                  Iniciar Sesión
                </button>
              </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
