import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Sparkles, Plus, Library, Download, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStoryOptionsStore } from '../store/storyOptions/storyOptionsStore';
import { DEFAULT_IMAGE_STYLE_ID } from '@/lib/image-styles';

interface IllustratedBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function IllustratedBooksModal({ isOpen, onClose }: IllustratedBooksModalProps) {
  const navigate = useNavigate();
  const { setCreationMode, setImageStyle } = useStoryOptionsStore();

  const handleCreateStory = () => {
    setCreationMode("image");
    setImageStyle(DEFAULT_IMAGE_STYLE_ID);
    onClose();
    navigate('/creation-mode');
  };

  const handleGoToStories = () => {
    onClose();
    navigate('/stories');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-3xl p-8 max-w-md w-full relative overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full blur-3xl opacity-30 -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-blue-200 to-indigo-200 rounded-full blur-2xl opacity-40 translate-y-12 -translate-x-12"></div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors z-10"
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>

            {/* Content */}
            <div className="relative z-10">
              {/* Icon and sparkles */}
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <BookOpen className="h-8 w-8 text-white" />
                  </motion.div>
                  {/* Sparkles animation */}
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="h-6 w-6 text-yellow-400" />
                  </motion.div>
                  <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.8, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    className="absolute -bottom-1 -left-2"
                  >
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  </motion.div>
                </div>
              </div>

              {/* Title */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-center mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
              >
                Nuevo formato de libro ilustrado mejorado
              </motion.h2>

              {/* Description */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-600 text-center mb-6 leading-relaxed"
              >
                Un diseño más limpio, tipografías mejoradas y maquetación optimizada. Mira un ejemplo rápido a continuación.
              </motion.p>

              {/* PDF Sample Preview */
              // Replace embedded preview with actions: open in new tab or download
              }
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="mb-6"
              >
                <div className="rounded-xl border border-purple-200 overflow-hidden shadow-sm">
                  <div className="px-4 py-2 bg-gradient-to-r from-purple-50 to-pink-50 text-sm text-purple-700 font-medium">
                    Vista previa (ejemplo)
                  </div>
                  <div className="p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-purple-800">
                        <div className="w-8 h-8 rounded-md bg-white shadow flex items-center justify-center">
                          <BookOpen className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">Libro ilustrado de ejemplo (PDF)</p>
                          <p className="text-xs text-purple-700/70">Formato mejorado y maquetación optimizada</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a
                          href="/previews/book-preview.pdf"
                          download
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-purple-200 bg-white text-purple-700 text-xs font-semibold hover:bg-purple-50"
                        >
                          <Download className="h-4 w-4" /> Descargar
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Action buttons */}
              <div className="space-y-3">
                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateStory}
                  className="w-full py-4 px-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                >
                  <Plus className="h-5 w-5" />
                  <span>Crear Nueva Historia</span>
                </motion.button>

                <motion.button
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleGoToStories}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-semibold rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl flex items-center justify-center space-x-3"
                >
                  <Library className="h-5 w-5" />
                  <span>Ver Mis Historias</span>
                </motion.button>
              </div>

              {/* Footer text */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-xs text-gray-500 text-center mt-6"
              >
                ✨ Convierte tus historias en experiencias visuales únicas
              </motion.p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
