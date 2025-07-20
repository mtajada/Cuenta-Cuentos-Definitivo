import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useUserStore } from '@/store/user/userStore'; // Adjust path if needed
import { supabase } from '@/supabaseClient'; // Adjust path if needed
import { useToast } from '@/hooks/use-toast'; // Adjust path if needed
import PageTransition from '@/components/PageTransition'; // Adjust path if needed
import BackButton from '@/components/BackButton';
import { motion } from 'framer-motion';
import {
    Star,
    BookOpen,
    TrendingUp,
    Mic,
    CheckCircle,
    XCircle,
    ChevronRight,
    ChevronLeft,
    Sparkles,
    CreditCard,
    Settings,
    AlertTriangle,
    Euro
} from 'lucide-react';

const PlansPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { profileSettings, isPremium } = useUserStore(
        (state) => ({
            profileSettings: state.profileSettings,
            isPremium: state.isPremium,
        })
    );

    const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
    const [isPortalLoading, setIsPortalLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'comparison' | 'details'>(isPremium() ? 'details' : 'comparison');
    const [activePlan, setActivePlan] = useState<'free' | 'premium'>(isPremium() ? 'premium' : 'free');

    // Handle tab query parameter
    useEffect(() => {
        const queryParams = new URLSearchParams(location.search);
        const tabParam = queryParams.get('tab');
        if (tabParam === 'premium') {
            setActivePlan('premium');
        } else if (tabParam === 'free') {
            setActivePlan('free');
        }
    }, [location.search]);

    const handleCheckout = async (item: 'premium' | 'credits') => {
        setIsCheckoutLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-checkout-session', {
                body: JSON.stringify({ item }),
            });

            if (error) throw error;

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió URL de checkout.');
            }
        } catch (error: Error | unknown) {
            console.error(`Error creating ${item} checkout session:`, error);
            toast({ title: 'Error', description: `No se pudo iniciar el pago: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: 'destructive' });
            setIsCheckoutLoading(false);
        } // No finally needed as page redirects on success
    };

    const handleManageSubscription = async () => {
        if (!profileSettings?.stripe_customer_id) {
            toast({ title: 'Error', description: 'No se encontró información de cliente para gestionar la suscripción.', variant: 'destructive' });
            return;
        }

        setIsPortalLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('create-customer-portal-session');

            if (error) throw error;

            if (data?.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No se recibió URL del portal de cliente.');
            }
        } catch (error: Error | unknown) {
            console.error("Error creating customer portal session:", error);
            toast({ title: 'Error', description: `No se pudo redirigir a la gestión de suscripción: ${error instanceof Error ? error.message : 'Error desconocido'}`, variant: 'destructive' });
            setIsPortalLoading(false);
        } // No finally block needed for isLoading as page redirects on success
    };

    const premiumUser = isPremium();

    // Define features for comparison table (updated per requirements)
    const features = [
        { name: 'Historias Generadas', free: '10 / mes', premium: 'Ilimitadas', icon: BookOpen, limited: true },
        { name: 'Continuaciones por Historia', free: '1', premium: 'Ilimitadas', icon: TrendingUp, limited: true },
        { name: 'Narración con Voz (IA)', free: 'Si (2 / mes)', premium: 'Sí (20/mes incl.)', icon: Mic, limited: true },
        { name: 'Retos Creativos', free: 'Ilimitados', premium: 'Ilimitados', icon: CheckCircle, limited: false },
    ];

    return (
        <PageTransition>
            <div
                className="relative min-h-screen flex flex-col items-center justify-start p-0"
                style={{
                    backgroundImage: 'url(/fondo_png.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            >
                {/* Logo y cabecera - Reducido espacio */}
                <div className="flex flex-col items-center mt-4 mb-0 select-none">
                    <img src="/logo_png.png" alt="TaleMe Logo" className="w-60 max-w-xs mx-auto mb-0 drop-shadow-xl" />
                </div>
                <div className="container mx-auto px-4 py-0 max-w-4xl">
                    {/* Back button */}
                    <BackButton className="absolute top-8 left-4 md:left-8" />
                    {/* Premium User View */}
                    {premiumUser && (
                        <div className="pt-0 flex flex-col min-h-[80vh] justify-between">
                            <div>
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="text-center mb-6"
                                >
                                    <div className="inline-flex justify-center items-center w-16 h-16 rounded-full bg-[#F9DA60] mb-2">
                                        <Star className="h-8 w-8 text-[#BB79D1]" />
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-bold mb-2 font-heading text-[#BB79D1]">Plan Premium Activo</h1>
                                    <p className="text-[#7DC4E0] text-lg">Disfruta de todas las funciones sin límites</p>
                                </motion.div>
                                <div className="grid md:grid-cols-2 gap-6 mt-8">
                                    {/* Card: Buy Voice Credits */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.1 }}
                                        className="bg-white/40 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border border-[#A5D6F6]/30"
                                    >
                                        <div className="p-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-[#A5D6F6]/40 flex items-center justify-center">
                                                    <Mic className="h-5 w-5 text-[#7DC4E0]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-xl font-heading text-[#BB79D1]">Créditos de Voz</h3>
                                                    <p className="text-[#7DC4E0] text-sm">Amplía tus narraciones</p>
                                                </div>
                                            </div>
                                            <div className="mb-6">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-[#BB79D1]">Disponibles:</span>
                                                    <span className="font-mono font-bold text-lg text-[#7DC4E0]">{profileSettings?.voice_credits || 0}</span>
                                                </div>
                                                <div className="h-2 bg-[#E6B7D9]/40 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-[#7DC4E0] to-[#BB79D1]"
                                                        style={{ width: `${Math.min(100, ((profileSettings?.voice_credits || 0) / 20) * 100)}%` }}></div>
                                                </div>
                                            </div>
                                            {/* TODO: Add credits button when the beta of premium is over*/}
                                            {/* <button
                                                onClick={() => handleCheckout('credits')}
                                                disabled={isCheckoutLoading}
                                                className="w-full py-3 px-4 bg-[#A5D6F6]/70 border border-[#A5D6F6]/60 hover:bg-[#A5D6F6] text-white rounded-2xl font-medium flex justify-center items-center gap-2 shadow-lg transform transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                                            >
                                                {isCheckoutLoading ? (
                                                    <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <>
                                                        <CreditCard className="h-4 w-4" />
                                                        <span>Comprar Créditos</span>
                                                    </>
                                                )}
                                            </button> */}
                                        </div>
                                    </motion.div>
                                    {/* Card: Manage Subscription */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.2 }}
                                        className="bg-white/40 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border border-[#F9DA60]/30"
                                    >
                                        <div className="p-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-10 h-10 rounded-full bg-[#F9DA60]/40 flex items-center justify-center">
                                                    <Star className="h-5 w-5 text-[#F9DA60]" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-xl font-heading text-[#BB79D1]">Suscripción Premium</h3>
                                                    <p className="text-[#7DC4E0] text-sm">Administra tu plan</p>
                                                </div>
                                            </div>
                                            <div className="space-y-4 mb-6">
                                                <div className="bg-white/70 rounded-lg p-3 flex justify-between items-center border border-[#F9DA60]/30">
                                                    <span className="text-[#222] font-medium">Estado:</span>
                                                    <span className="font-bold text-[#F9DA60] bg-[#F9DA60]/20 px-3 py-1 rounded-full border border-[#F9DA60]/30">Activo</span>
                                                </div>
                                                <div className="bg-[#F6A5B7]/10 rounded-lg p-3 flex justify-between items-center">
                                                    <span className="text-[#BB79D1]">Beneficios:</span>
                                                    <span className="font-medium text-[#BB79D1]">Todos los incluidos</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={handleManageSubscription}
                                                disabled={isPortalLoading}
                                                className="flex items-center justify-between w-full py-3 px-4 bg-[#F9DA60]/60 border border-[#F9DA60]/40 hover:bg-[#F9DA60]/80 text-[#BB79D1] rounded-2xl font-medium transition-all shadow-md hover:shadow-lg"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <Settings className="h-4 w-4" />
                                                    <span>Gestionar Suscripción</span>
                                                </div>
                                                {isPortalLoading ? (
                                                    <div className="h-4 w-4 border-2 border-[#BB79D1] border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </button>
                                        </div>
                                    </motion.div>
                                </div>
                                {/* Bottom Premium Features Reminder */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.3 }}
                                    className="mt-8 bg-white/60 backdrop-blur-md rounded-3xl p-5 border border-[#F9DA60]/40 shadow-lg"
                                >
                                    <h3 className="font-bold text-xl mb-4 flex items-center gap-2 font-heading text-[#BB79D1]">
                                        <Sparkles className="h-6 w-6 text-[#F9DA60]" />
                                        <span>Beneficios Premium Activos</span>
                                    </h3>
                                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {features.map((feature, i) => (
                                            <li key={i} className="flex items-center gap-3 bg-white/70 p-3 rounded-xl border border-[#BB79D1]/10 shadow-sm">
                                                <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <feature.icon className="h-4 w-4 text-[#7DC4E0]" />
                                                        <span className="font-bold text-[#222]">{feature.name}</span>
                                                    </div>
                                                    <span className="text-sm font-medium text-[#BB79D1]">{feature.premium}</span>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </motion.div>
                                {/* Botón para ir a la app */}
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5, delay: 0.4 }}
                                    className="mt-8 mb-14 text-center"
                                >
                                    <Link
                                        to="/home"
                                        className="inline-block py-3 px-6 bg-[#BB79D1] hover:bg-[#A37AC2] text-white rounded-2xl font-medium flex items-center justify-center gap-2 shadow-lg transform transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] mx-auto"
                                    >
                                        <BookOpen className="h-5 w-5" />
                                        <span>Ir a la aplicación</span>
                                    </Link>
                                </motion.div>
                            </div>
                        </div>
                    )}
                    {/* Free User View */}
                    {!premiumUser && (
                        <div className="pt-0 flex flex-col min-h-[80vh] justify-between">
                            <div>
                                {/* Header */}
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5 }}
                                    className="text-center mb-4"
                                >
                                    <h1 className="text-3xl md:text-4xl font-bold mb-1 font-heading text-[#BB79D1]">Desbloquea tu Creatividad</h1>
                                    <p className="text-[#7DC4E0] text-lg mx-auto max-w-xl">
                                        Compara los planes y elige la mejor experiencia para tus historias
                                    </p>
                                </motion.div>
                                {/* Plan Toggle */}
                                <div className="flex justify-center mb-4">
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.5, delay: 0.1 }}
                                        className="bg-white/40 backdrop-blur-md rounded-full p-1 inline-flex"
                                    >
                                        <button
                                            onClick={() => setActivePlan('free')}
                                            className={`py-2 px-5 md:px-8 rounded-full transition-colors flex items-center gap-2 ${activePlan === 'free'
                                                ? 'bg-[#F6A5B7]/60 text-white font-medium'
                                                : 'text-[#BB79D1] hover:text-white'
                                                }`}
                                        >
                                            <span>Free</span>
                                        </button>
                                        <button
                                            onClick={() => setActivePlan('premium')}
                                            className={`py-2 px-5 md:px-8 rounded-full transition-colors flex items-center gap-2 relative ${activePlan === 'premium'
                                                ? 'bg-gradient-to-r from-[#F9DA60] to-[#F9DA60]/80 text-white font-medium'
                                                : 'text-[#BB79D1] hover:text-white'
                                                }`}
                                        >
                                            <Star className="h-4 w-4" />
                                            <span>Premium</span>
                                        </button>
                                    </motion.div>
                                </div>
                                {/* Features by Plan */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                    className="max-w-2xl mx-auto"
                                >
                                    {/* Active Plan Card */}
                                    <div className="bg-white/70 backdrop-blur-md rounded-3xl overflow-hidden shadow-xl border border-[#BB79D1]/20 mb-6">
                                        {/* Plan Header - Mejorada legibilidad */}
                                        <div className={`p-6 ${activePlan === 'premium'
                                            ? 'bg-[#F9DA60]/20 border-b border-[#F9DA60]/40'
                                            : 'bg-[#F6A5B7]/20 border-b border-[#BB79D1]/20'
                                            }`}>
                                            <div className="flex justify-between items-center">
                                                <h2 className="text-2xl font-bold flex items-center gap-2 font-heading text-[#BB79D1]">
                                                    {activePlan === 'premium' && <Star className="h-5 w-5 text-[#F9DA60]" />}
                                                    Plan {activePlan === 'premium' ? 'Premium' : 'Free'}
                                                </h2>
                                            </div>
                                            {activePlan === 'premium' ? (
                                                <>
                                                    <p className="text-[#BB79D1] mt-1 font-medium">Creatividad sin límites para tus historias</p>
                                                    <div className="flex items-center mt-3 bg-white/70 p-3 rounded-xl justify-between border border-[#F9DA60]">
                                                        <div className="flex items-center gap-2">
                                                            <Euro className="h-5 w-5 text-[#F9DA60]" />
                                                            <span className="text-[#222] font-medium">Precio:</span>
                                                        </div>
                                                        <div className="font-bold text-xl text-[#BB79D1] flex items-center gap-1">
                                                            <span>9.98€</span>
                                                            <span className="text-sm font-normal text-[#222] opacity-80">/mes</span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <p className="text-[#7DC4E0] mt-1">Perfecto para comenzar a explorar</p>
                                            )}
                                        </div>

                                        {/* Premium "Hazte Premium" button - Only shown on premium tab */}
                                        {activePlan === 'premium' && (
                                            <div className="p-6 pt-4 pb-0">
                                                <button
                                                    onClick={() => handleCheckout('premium')}
                                                    disabled={isCheckoutLoading}
                                                    className="w-full py-3 px-6 bg-gradient-to-r from-[#F9DA60]/60 to-[#F9DA60]/40 text-[#BB79D1] rounded-2xl font-bold flex justify-center items-center gap-2 shadow-lg transition-all duration-200 hover:scale-105 hover:bg-[#BB79D1]/90"
                                                >
                                                    <Star className="h-5 w-5" />
                                                    <span>Hazte Premium Ahora</span>
                                                </button>
                                            </div>
                                        )}

                                        {/* Features List - Consistent style for both tabs */}
                                        <div className="p-6">
                                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 font-heading text-[#BB79D1]">
                                                <Sparkles className="h-5 w-5 text-[#F9DA60]" />
                                                <span>{activePlan === 'premium' ? 'Beneficios Premium' : 'Características del plan'}</span>
                                            </h3>

                                            <ul className="space-y-3">
                                                {features.map((feature, index) => (
                                                    <li key={index} className="bg-white/60 p-3 rounded-lg border border-[#BB79D1]/10 shadow-sm">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex-shrink-0">
                                                                {activePlan === 'premium' ? (
                                                                    feature.premium === 'No' ? (
                                                                        <XCircle className="h-5 w-5 text-red-400" />
                                                                    ) : (
                                                                        <CheckCircle className="h-5 w-5 text-green-500" />
                                                                    )
                                                                ) : (
                                                                    feature.free === 'No' ? (
                                                                        <XCircle className="h-5 w-5 text-red-400" />
                                                                    ) : (
                                                                        feature.limited ? (
                                                                            <AlertTriangle className="h-5 w-5 text-[#F9DA60]" />
                                                                        ) : (
                                                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                                                        )
                                                                    )
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <feature.icon className="h-4 w-4 text-[#7DC4E0]" />
                                                                    <span className="font-bold text-[#222]">{feature.name}</span>
                                                                </div>
                                                                <div className="text-sm font-medium text-[#444]">
                                                                    {activePlan === 'premium' ? feature.premium : feature.free}
                                                                    {activePlan === 'free' && feature.limited && (
                                                                        <span className="text-xs text-[#BB79D1] ml-1 font-bold">(limitado)</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                            {/* Botones de navegación entre planes - Con espacio abajo */}
                            <div className="flex flex-col md:flex-row justify-center gap-4 mb-10">
                                {activePlan === 'free' && (
                                    <button
                                        onClick={() => setActivePlan('premium')}
                                        className="py-3 px-8 bg-gradient-to-r from-[#F6A5B7] to-[#BB79D1] text-white rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:bg-[#BB79D1]/90"
                                    >
                                        <Star className="h-5 w-5" />
                                        <span>Ver plan Premium</span>
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                )}
                                {activePlan === 'premium' && (
                                    <button
                                        onClick={() => setActivePlan('free')}
                                        className="py-3 px-8 bg-[#A5D6F6]/70 text-[#BB79D1] rounded-2xl font-bold shadow-lg flex items-center gap-2 transition-all duration-200 hover:scale-105 hover:bg-[#BB79D1]/20"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        <span>Ver plan Free</span>
                                    </button>
                                )}
                                {/* Botón para continuar gratis */}
                                {activePlan === 'free' && (
                                    <Link
                                        to="/home"
                                        className="py-3 px-8 bg-transparent border border-[#BB79D1]/50 hover:bg-[#BB79D1]/10 text-[#BB79D1] rounded-2xl font-bold transition-all shadow-sm hover:shadow-md flex items-center gap-2"
                                    >
                                        Continuar con el plan gratuito
                                    </Link>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </PageTransition>
    );
};

export default PlansPage;