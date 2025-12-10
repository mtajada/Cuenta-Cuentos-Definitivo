import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { BookOpen, Image, Info, Palette, Sparkles } from "lucide-react";
import PageTransition from "../components/PageTransition";
import BackButton from "../components/BackButton";
import StoryButton from "../components/StoryButton";
import { useStoryOptionsStore } from "../store/storyOptions/storyOptionsStore";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DEFAULT_IMAGE_STYLE_ID,
  IMAGE_STYLES,
  ImageStyleId,
  isValidImageStyleId,
  normalizeImageStyleId,
} from "@/lib/image-styles";

type CreationMode = "standard" | "image";

const creationModes: Array<{
  id: CreationMode;
  title: string;
  description: string;
  icon: JSX.Element;
  accent: string;
}> = [
  {
    id: "standard",
    title: "Cuento estándar",
    description: "Texto y narración habitual sin imágenes adicionales.",
    icon: <BookOpen className="h-7 w-7" />,
    accent: "from-[#BB79D1]/80 to-[#F6A5B7]/80",
  },
  {
    id: "image",
    title: "Creación con imagen",
    description: "Incluye ilustraciones con el estilo visual que elijas.",
    icon: <Image className="h-7 w-7" />,
    accent: "from-[#A5D6F6]/80 to-[#E6B7D9]/80",
  },
];

export default function StoryCreationMode() {
  const navigate = useNavigate();
  const { currentStoryOptions, setCreationMode, setImageStyle } = useStoryOptionsStore();
  const selectedMode = currentStoryOptions.creationMode as CreationMode | undefined;
  const selectedStyle = isValidImageStyleId(currentStoryOptions.imageStyle)
    ? currentStoryOptions.imageStyle
    : undefined;
  const [modeTouched, setModeTouched] = useState(() => selectedMode === "image");

  const effectiveSelectedMode = modeTouched ? selectedMode : selectedMode === "image" ? "image" : undefined;
  const isImageMode = effectiveSelectedMode === "image";
  useEffect(() => {
    if (selectedMode === "image" && !modeTouched) {
      setModeTouched(true);
    }
  }, [modeTouched, selectedMode]);
  useEffect(() => {
    if (isImageMode && !selectedStyle) {
      setImageStyle(DEFAULT_IMAGE_STYLE_ID);
    }
  }, [isImageMode, selectedStyle, setImageStyle]);

  const canContinue = useMemo(
    () => Boolean(modeTouched && effectiveSelectedMode && (!isImageMode || selectedStyle)),
    [effectiveSelectedMode, isImageMode, modeTouched, selectedStyle]
  );

  const handleModeSelect = (mode: CreationMode) => {
    setModeTouched(true);
    setCreationMode(mode);
    if (mode === "image" && !selectedStyle) {
      setImageStyle(DEFAULT_IMAGE_STYLE_ID);
    } else if (mode === "image" && selectedStyle) {
      setImageStyle(normalizeImageStyleId(selectedStyle));
    }
  };

  const handleStyleSelect = (styleId: ImageStyleId) => {
    if (!isValidImageStyleId(styleId)) return;

    setModeTouched(true);
    if (selectedMode !== "image") {
      setCreationMode("image");
    }
    setImageStyle(normalizeImageStyleId(styleId));
  };

  const handleContinue = () => {
    if (!canContinue) return;
    navigate("/duration");
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <PageTransition>
      <div
        className="min-h-screen flex flex-col items-center justify-center relative"
        style={{
          backgroundImage: "url(/fondo_png.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <BackButton />

        <div className="w-full max-w-5xl mx-auto px-4 py-10">
          <div className="text-center mb-6">
            <p className="text-sm font-semibold text-[#7DC4E0] uppercase tracking-wide mb-2">
              Paso 1 · Configura tu experiencia
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#BB79D1] font-heading drop-shadow-lg mb-3">
              Modo de creación
            </h1>
            <p className="text-lg text-[#222] bg-white/70 rounded-xl px-4 py-3 inline-block shadow-sm">
              Elige si quieres un cuento estándar o uno ilustrado con estilo visual propio.
            </p>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10"
          >
            {creationModes.map((mode) => (
              <motion.button
                key={mode.id}
                variants={itemVariants}
                onClick={() => handleModeSelect(mode.id)}
                className={`
                  group text-left w-full overflow-hidden rounded-3xl border-2 border-white/40 bg-white/50 backdrop-blur
                  p-5 sm:p-6 shadow-md transition-all duration-300
                  ${effectiveSelectedMode === mode.id ? "ring-4 ring-[#BB79D1] shadow-xl scale-[1.01]" : "hover:-translate-y-1 hover:shadow-lg"}
                `}
              >
                <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${mode.accent} mb-4`} />
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-white/60 text-[#BB79D1] shadow-inner">
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-xl font-semibold text-[#222] mb-1">{mode.title}</p>
                    <p className="text-sm text-[#7DC4E0]">{mode.description}</p>
                  </div>
                  {mode.id === "image" && (
                    <div className="flex items-center gap-2 text-[#BB79D1] font-semibold text-sm">
                      <Sparkles className="h-4 w-4" />
                      <span>Ilustrado</span>
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </motion.div>

          {isImageMode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white/60 border border-[#BB79D1]/20 rounded-3xl p-6 shadow-md"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <p className="text-sm font-semibold text-[#7DC4E0] uppercase tracking-wide">
                    Estilo visual
                  </p>
                  <h2 className="text-2xl font-bold text-[#BB79D1] font-heading">
                    Elige la estética de tus ilustraciones
                  </h2>
                </div>
                <div className="flex items-center gap-2 text-sm text-[#222] bg-white/80 border border-[#BB79D1]/25 px-3 py-2 rounded-xl shadow-sm">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#BB79D1]/15 text-[#BB79D1]">
                        <Info className="h-4 w-4" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-white text-[#222] border border-[#BB79D1]/20 shadow-lg">
                      El estilo se aplicará a portada y escenas.
                    </TooltipContent>
                  </Tooltip>
                  <span className="font-medium">El estilo se aplicará a portada y escenas.</span>
                </div>
              </div>

              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {IMAGE_STYLES.map((style) => (
                  <motion.button
                    key={style.id}
                    variants={itemVariants}
                    onClick={() => handleStyleSelect(style.id)}
                    className={`
                      group text-left w-full overflow-hidden rounded-2xl border-2 border-[#BB79D1]/20 bg-white/70 backdrop-blur
                      p-3 shadow-sm transition-all duration-300
                      ${selectedStyle === style.id ? "ring-4 ring-[#BB79D1] shadow-xl scale-[1.01]" : "hover:-translate-y-1 hover:shadow-lg"}
                    `}
                  >
                    <div className="relative h-32 w-full rounded-xl overflow-hidden mb-3">
                      <img
                        src={style.thumbnail}
                        alt={style.label}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div className={`absolute inset-0 bg-gradient-to-br ${style.overlayGradient}`} />
                      <div className="absolute top-2 left-2 inline-flex items-center gap-2 bg-white/80 text-[#222] text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                        <Palette className="h-4 w-4 text-[#BB79D1]" />
                        <span>{style.label}</span>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-[#222]">{style.label}</p>
                        <p className="text-sm text-[#7DC4E0]">{style.description}</p>
                      </div>
                      <div className="flex items-center text-[#F6A5B7]">
                        <Sparkles className="h-5 w-5" />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </motion.div>
            </motion.div>
          )}

          <div className="flex justify-center w-full mt-8">
            <StoryButton
              onClick={handleContinue}
              disabled={!canContinue}
              className="w-full max-w-sm py-4 rounded-2xl text-white text-lg font-semibold shadow-lg bg-[#BB79D1] hover:bg-[#BB79D1]/90 border-2 border-[#BB79D1]/50 transition-all duration-200"
            >
              Continuar
            </StoryButton>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
