import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import PageTransition from "../components/PageTransition";
import { useToast } from "@/hooks/use-toast";
import { login, requestPasswordReset, signInWithGoogle } from "../supabaseAuth";

export default function Login() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/home');
    }
  }, [user, navigate]);

  const form = useForm({
    defaultValues: {
      email: "",
      password: ""
    }
  });

  const handleLogin = async (data: { email: string; password: string }) => {
    try {
      setIsLoading(true);
      const { user, error } = await login(data.email, data.password);

      if (error) {
        toast({
          title: "Error de inicio de sesión",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      if (user) {
        toast({
          title: "Inicio de sesión exitoso",
          description: "¡Bienvenido de nuevo!",
        });
      } else {
        toast({
          title: "Error de inicio de sesión",
          description: "Credenciales inválidas",
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error inesperado",
        variant: "destructive"
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      const { error } = await signInWithGoogle();

      if (error) {
        toast({
          title: "Error al iniciar sesión con Google",
          description: error.message,
          variant: "destructive"
        });
      }
    } catch (err) {
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error al iniciar sesión con Google",
        variant: "destructive"
      });
      console.error(err);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues("email");
    if (!email) {
      toast({
        title: "Email requerido",
        description: "Por favor ingresa tu correo electrónico para restablecer la contraseña",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await requestPasswordReset(email);

      if (error) {
        toast({
          title: "Error al solicitar restablecimiento",
          description: error.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Solicitud enviada",
        description: "Revisa tu correo electrónico para restablecer tu contraseña",
      });
    } catch (err) {
      toast({
        title: "Error inesperado",
        description: "Ha ocurrido un error inesperado",
        variant: "destructive"
      });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword(!showPassword);

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
        <div className="w-full max-w-md bg-white/70 rounded-3xl p-8 shadow-lg border border-[#BB79D1]/20">
          <div className="flex justify-center mb-6">
            <img src="/logo_png.png" alt="TaleMe Logo" className="w-48 max-w-full" />
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleLogin)}
              className="space-y-5"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#BB79D1]" size={20} />
                      <FormControl>
                        <Input
                          placeholder="Correo electrónico"
                          className="pl-10 py-6 rounded-xl bg-white/80 border-[#BB79D1]/30 focus:border-[#BB79D1] focus:ring-1 focus:ring-[#BB79D1] text-[#333]"
                          type="email"
                          {...field}
                          required
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#BB79D1]" size={20} />
                      <FormControl>
                        <Input
                          placeholder="Contraseña"
                          className="pl-10 pr-10 py-6 rounded-xl bg-white/80 border-[#BB79D1]/30 focus:border-[#BB79D1] focus:ring-1 focus:ring-[#BB79D1] text-[#333]"
                          type={showPassword ? "text" : "password"}
                          {...field}
                          required
                        />
                      </FormControl>
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#BB79D1] hover:text-[#A5D6F6] transition-colors"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberSession}
                    onChange={() => setRememberSession(!rememberSession)}
                    className="rounded text-[#F6A5B7] focus:ring-[#F6A5B7] border-[#BB79D1]/30"
                  />
                  <span className="text-sm text-[#555]">Recordar sesión</span>
                </label>

                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-[#BB79D1] hover:text-[#A5D6F6] hover:underline transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-2xl text-white text-lg font-semibold shadow-lg transition-all duration-200 bg-[#F6A5B7] hover:bg-[#F6A5B7]/80 active:bg-[#F6A5B7]/90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
              </button>


              <div className="relative flex items-center my-4">
                <div className="flex-grow border-t border-[#BB79D1]/20"></div>
                <span className="mx-4 flex-shrink text-[#555] text-sm">O continúa con</span>
                <div className="flex-grow border-t border-[#BB79D1]/20"></div>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="w-full flex items-center justify-center gap-2 bg-white text-[#333] rounded-xl py-3 hover:bg-gray-100 transition-colors duration-300 border border-[#BB79D1]/20 shadow-md"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="24px" height="24px">
                  <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                  <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                  <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                  <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                </svg>
                {isGoogleLoading ? "Conectando..." : "Iniciar sesión con Google"}
              </button>

              <div className="text-center mt-5">
                <span className="text-[#555] text-sm">¿No tienes una cuenta? </span>
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="text-[#BB79D1] font-semibold text-sm hover:underline"
                >
                  Registrarse
                </button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </PageTransition>
  );
}
