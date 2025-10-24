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
  },

  /**
   * Configuración de logos de colaboración para PDFs
   */
  pdfCollaboration: {
    enabled: import.meta.env.VITE_LOGO_COLABORATION === 'true' || false,
    logoName: import.meta.env.VITE_LOGO_COLABORATION_NAME || '',
    logoPath: '/logotipos'
  }
}; 