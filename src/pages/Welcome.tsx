import { motion } from "framer-motion";
import { BookOpen, Sparkles, Headphones, Brain, LogIn, UserPlus, Star, Gift, Zap } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import PageTransition from "../components/PageTransition";
import { useAuth } from "../context/AuthContext";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}

export default function Welcome() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate("/home");
      }
      setIsLoading(false);
    }
  }, [loading, user, navigate]);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{
          backgroundImage: 'url(/fondo_png.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center p-3 backdrop-blur-sm">
          <div className="animate-spin h-full w-full border-4 border-[#F6A5B7] rounded-full border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <PageTransition>
      <div 
        className="min-h-screen flex flex-col items-center overflow-auto"
        style={{
          backgroundImage: 'url(/fondo_png.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <header className="w-full max-w-6xl px-4 sm:px-6 md:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo_png.png" alt="TaleMe Logo" className="h-20 md:h-24" />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/login")}
              className="py-2 px-4 rounded-xl text-[#333] font-medium bg-white/80 hover:bg-white transition-all duration-200 shadow-md"
            >
              Iniciar Sesión
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="py-2 px-4 rounded-xl text-white font-medium bg-[#F6A5B7] hover:bg-[#F6A5B7]/90 transition-all duration-200 shadow-md"
            >
              Registrarse
            </button>
          </div>
        </header>

        <main className="w-full max-w-6xl px-4 sm:px-6 md:px-8 py-6 md:py-8 flex flex-col items-center">
          {/* Hero Section */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-center mb-10 md:mb-12"
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-4 text-[#222]">
              Historias mágicas <span className="text-[#BB79D1]">personalizadas</span>
            </h1>
            <p className="text-lg md:text-xl text-[#333] max-w-2xl mx-auto mb-8">
              Crea cuentos únicos adaptados a los gustos y personalidad de cada niño, con narración de voz y retos educativos.
            </p>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <button
                onClick={() => navigate("/signup")}
                className="py-3 px-8 rounded-2xl text-white text-lg font-semibold bg-[#F6A5B7] hover:bg-[#F6A5B7]/90 transition-all duration-200 shadow-lg flex items-center justify-center gap-2"
              >
                <BookOpen size={20} />
                <span>CREAR MI PRIMERA HISTORIA</span>
              </button>
            </motion.div>
          </motion.div>

          {/* Features Section */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
            className="w-full mb-12"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-[#222]">
              ¿Qué hace especial a <span className="text-[#BB79D1]">TaleMe</span>?
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              <FeatureCard
                icon={<Sparkles className="w-6 h-6" />}
                title="Historias Personalizadas"
                description="Cuentos adaptados a los gustos, edad y personalidad de cada niño."
                color="#F6A5B7"
              />
              <FeatureCard
                icon={<Headphones className="w-6 h-6" />}
                title="Narración de Voz"
                description="Narraciones profesionales que dan vida a cada historia."
                color="#7DC4E0"
              />
              <FeatureCard
                icon={<Brain className="w-6 h-6" />}
                title="Retos Educativos"
                description="Mejora la lectura, matemáticas e idiomas con juegos divertidos."
                color="#BB79D1"
              />
            </div>
          </motion.div>

          {/* Benefits Section */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8, ease: "easeOut" }}
            className="w-full mb-12 bg-white/70 rounded-3xl p-8 shadow-lg border border-[#BB79D1]/20"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-[#222]">
              Beneficios para toda la familia
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <BenefitItem
                icon={<Star className="text-[#F9DA60]" size={24} />}
                title="Fomenta la imaginación"
                description="Historias que estimulan la creatividad y el pensamiento."
              />
              <BenefitItem
                icon={<BookOpen className="text-[#F6A5B7]" size={24} />}
                title="Mejora la lectura"
                description="Desarrolla habilidades de comprensión y vocabulario."
              />
              <BenefitItem
                icon={<Gift className="text-[#BB79D1]" size={24} />}
                title="Momentos especiales"
                description="Crea recuerdos únicos con historias personalizadas."
              />
              <BenefitItem
                icon={<Zap className="text-[#7DC4E0]" size={24} />}
                title="Aprendizaje divertido"
                description="Retos educativos integrados en cada historia."
              />
              <BenefitItem
                icon={<Brain className="text-[#F6A5B7]" size={24} />}
                title="Desarrollo cognitivo"
                description="Estimula el pensamiento crítico y la resolución de problemas."
              />
              <BenefitItem
                icon={<Sparkles className="text-[#F9DA60]" size={24} />}
                title="Personalización total"
                description="Adapta cada historia a los intereses del niño."
              />
            </div>
          </motion.div>
        </main>
      </div>
    </PageTransition>
  );
}

function FeatureCard({ icon, title, description, color }: FeatureCardProps) {
  return (
    <div className="bg-white/70 rounded-2xl p-6 shadow-lg border border-[#BB79D1]/20 h-full transition-all duration-300 hover:shadow-xl hover:transform hover:scale-105">
      <div className="flex items-center mb-4">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center mr-4"
          style={{ backgroundColor: `${color}30` }}
        >
          <div className="text-[#333]" style={{ color }}>
            {icon}
          </div>
        </div>
        <h3 className="text-xl font-semibold text-[#333]">{title}</h3>
      </div>
      <p className="text-[#555]">{description}</p>
    </div>
  );
}

function BenefitItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start">
      <div className="mr-4 mt-1">
        {icon}
      </div>
      <div>
        <h4 className="text-lg font-semibold text-[#333] mb-1">{title}</h4>
        <p className="text-[#555]">{description}</p>
      </div>
    </div>
  );
}
