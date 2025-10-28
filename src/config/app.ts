/**
 * Configuración global de la aplicación
 * Este archivo contiene parámetros y configuraciones globales que pueden ser utilizados en toda la app
 */

export const APP_CONFIG = {
  /**
   * Versión actual de la aplicación
   * Formato: major.minor.patch
   */
  version: '1.1.3',

  /**
   * Nombre de la aplicación
   */
  name: 'TaleMe',
  
  /**
   * URL del sitio web
   */
  websiteUrl: 'https://taleme.app',
  
  /**
   * Supabase configuration
   */
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  
  /**
   * Payment configuration
   * When VITE_ENABLE_PAY is false, users can generate illustrated stories without payment
   * Useful for development and testing purposes
   */
  enablePayment: import.meta.env.VITE_ENABLE_PAY === 'true',
  
  /**
   * Enlaces de redes sociales
   */
  socialLinks: {
    twitter: 'https://twitter.com/taleme_app',
    instagram: 'https://instagram.com/taleme_app',
    facebook: 'https://facebook.com/talemeapp'
  },

  /**
   * URLs del footer
   */
  footerLinks: {
    terms: '/terms',
    privacy: '/privacy-policy',
    contact: '/contact',
    changelog: '/changelog'
  }
}; 