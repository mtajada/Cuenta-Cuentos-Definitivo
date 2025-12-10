import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Open Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				heading: ['Quicksand', 'ui-sans-serif', 'system-ui', 'sans-serif'],
			},
			colors: {
				'brand': {
					'pink': '#FDDDE3',      // Rosa Base
					'purple': '#BB79D1',    // Morado
					'blue': '#7DC4E0',      // Azul Claro
					'yellow': '#F9DA60',    // Amarillo
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: '#FFFBF5',       // Un blanco muy suave con tinte rosa/amarillo
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: '#BB79D1',     // Morado como primario
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: '#7DC4E0',     // Azul como secundario
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: '#F9DA60',     // Amarillo como acento
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: '#FFFFFF',     // Blanco puro para tarjetas
					foreground: 'hsl(var(--card-foreground))'
				},
				'text-primary': '#4A4A4A',  // Gris oscuro para texto principal
				'text-secondary': '#757575', // Gris medio para texto secundario
				story: {
					purple: {
						DEFAULT: '#3F2E5D',
						50: '#F5F2FA',
						100: '#EBE6F5',
						200: '#D7CCE9',
						300: '#C3B3DE',
						400: '#AF99D2',
						500: '#9B80C7',
						600: '#8767BB',
						700: '#6E4CA6',
						800: '#563C82',
						900: '#3F2E5D',
						950: '#302246'
					},
					orange: {
						DEFAULT: '#F4A261',
						50: '#FEF5EE',
						100: '#FDEADC',
						200: '#FBCFAF',
						300: '#F9B383',
						400: '#F4A261',
						500: '#F08430',
						600: '#DD6A10',
						700: '#A64F0C',
						800: '#6F3608',
						900: '#371A04'
					},
					blue: {
						DEFAULT: '#457B9D',
						50: '#E9F0F4',
						100: '#D3E1E8',
						200: '#A7C3D1',
						300: '#7BAABF',
						400: '#5692AE',
						500: '#457B9D',
						600: '#345C75',
						700: '#233E4E',
						800: '#111F26',
						900: '#06090B'
					},
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'fade-out': {
					'0%': { opacity: '1', transform: 'translateY(0)' },
					'100%': { opacity: '0', transform: 'translateY(10px)' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'scale-out': {
					from: { transform: 'scale(1)', opacity: '1' },
					to: { transform: 'scale(0.95)', opacity: '0' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-right': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'pulse-subtle': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.8' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-5px)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.5s ease-out',
				'fade-out': 'fade-out 0.5s ease-out',
				'scale-in': 'scale-in 0.3s ease-out',
				'scale-out': 'scale-out 0.3s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'slide-out-right': 'slide-out-right 0.3s ease-out',
				'pulse-subtle': 'pulse-subtle 2s infinite ease-in-out',
				'float': 'float 3s infinite ease-in-out'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
