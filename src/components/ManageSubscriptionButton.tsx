import { useState } from 'react';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx'; 
import { useToast } from '@/hooks/use-toast.ts'; 
import { createCustomerPortalSession } from '../services/stripeService.ts'; 

interface ManageSubscriptionButtonProps {
  className?: string;
}

export default function ManageSubscriptionButton({ className = '' }: ManageSubscriptionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleManageSubscription = async () => {
    setIsLoading(true);

    try {
      // Llamada a la función del servicio (que llama a la Edge Function)
      const { url, error } = await createCustomerPortalSession();

      if (error) {
        // Manejo de errores específicos devueltos por el servicio
        console.error("Error from createCustomerPortalSession:", error);
        // Podrías querer ser más específico aquí si el servicio devuelve códigos o mensajes clave
        if (error.includes('No se encontró información de cliente') || error.includes('404')) { // Ejemplo de verificación
          toast({
            title: "No hay suscripción activa",
            description: "Necesitas tener una suscripción activa o haber realizado una compra previamente.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Error al acceder al portal",
            description: error, // Muestra el error devuelto por el servicio/función
            variant: "destructive"
          });
        }
      } else if (url) {
        // Redirigir al Stripe Customer Portal
        console.log(`Redirigiendo al Portal de Cliente de Stripe: ${url}`);
        window.location.href = url;
      } else {
        // Caso inesperado: sin error pero sin URL
        console.error("No URL received from createCustomerPortalSession");
        toast({
          title: "Error",
          description: "No se recibió una URL válida del portal.",
          variant: "destructive"
        });
      }
    } catch (err) { // err es 'unknown'
      // Manejo de errores inesperados (ej. red, error no capturado antes)
      console.error("Unexpected error in handleManageSubscription:", err);
      const errorMessage = "Ocurrió un error inesperado al procesar la solicitud.";
      // Opcional: intentar obtener un mensaje más específico
      // if (err instanceof Error) { errorMessage = err.message; }
      // else if (typeof err === 'string') { errorMessage = err; }
      toast({
        title: "Error inesperado",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleManageSubscription}
      disabled={isLoading}
      className={`bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium py-2 px-4 rounded-lg shadow-md transition-all duration-300 flex items-center justify-center ${className}`}
    >
      <Settings className="mr-2 h-5 w-5" />
      {isLoading ? 'Procesando...' : 'Gestionar Suscripción'}
    </Button>
  );
}
