import type { Config } from "tailwindcss";

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
				sans: ['Inter', 'Poppins', 'system-ui', 'sans-serif'],
				inter: ['Inter', 'sans-serif'],
				poppins: ['Poppins', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
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
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Grove Guess Modern Colors
				'electric-purple': 'hsl(var(--electric-purple))',
				'neon-blue': 'hsl(var(--neon-blue))',
				'cyber-green': 'hsl(var(--cyber-green))',
				'hot-pink': 'hsl(var(--hot-pink))',
				'golden-yellow': 'hsl(var(--golden-yellow))',
				'orange-red': 'hsl(var(--orange-red))',
				// Gaming Colors
				'neon-orange': 'hsl(var(--neon-orange))',
				'neon-purple': 'hsl(var(--neon-purple))',
				'neon-green': 'hsl(var(--neon-green))',
				'neon-yellow': 'hsl(var(--neon-yellow))',
				'surface': 'hsl(var(--surface))',
				'surface-elevated': 'hsl(var(--surface-elevated))',
				'glass-light': 'hsl(var(--glass-light))',
				'glass-border': 'hsl(var(--glass-border))',
				'danger': 'hsl(var(--danger))',
				// Galinheiro Musical custom colors
				'chicken-orange': 'hsl(var(--chicken-orange))',
				'egg-shell': 'hsl(var(--egg-shell))',
				'barn-brown': 'hsl(var(--barn-brown))',
				'feather-white': 'hsl(var(--feather-white))',
				'corn-golden': 'hsl(var(--corn-golden))'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-secondary': 'var(--gradient-secondary)',
				'gradient-accent': 'var(--gradient-accent)',
				'gradient-dark': 'var(--gradient-dark)',
				'gradient-sunrise': 'var(--gradient-sunrise)',
				'gradient-barn': 'var(--gradient-barn)',
				'gradient-grass': 'var(--gradient-grass)',
				'gradient-sky': 'var(--gradient-sky)',
				'glass': 'linear-gradient(135deg, hsl(var(--glass-light) / 0.1), hsl(var(--glass-light) / 0.05))'
			},
			spacing: {
				'18': '4.5rem',
				'88': '22rem',
				'100': '25rem',
				'112': '28rem',
				'128': '32rem',
			},
			boxShadow: {
				'glow': 'var(--shadow-glow)',
				'neon': 'var(--shadow-neon)',
				'soft': 'var(--shadow-soft)',
				'glass': 'var(--shadow-glass)',
				'xl-glow': '0 0 60px hsl(var(--electric-purple) / 0.4)',
			},
			backdropBlur: {
				xs: '2px',
			},
			transitionTimingFunction: {
				'elastic': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
				'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				xl: '1rem',
				'2xl': '1.25rem',
				'3xl': '1.5rem',
			},
			keyframes: {
				'accordion-down': {
					'0%': { height: '0' },
					'100%': { height: 'var(--radix-accordion-content-height)' },
				},
				'accordion-up': {
					'0%': { height: 'var(--radix-accordion-content-height)' },
					'100%': { height: '0' },
				},
				'chicken-walk': {
					'0%': { transform: 'translateX(-10px) rotate(-2deg)' },
					'25%': { transform: 'translateX(-5px) rotate(0deg)' },
					'50%': { transform: 'translateX(0px) rotate(2deg)' },
					'75%': { transform: 'translateX(5px) rotate(0deg)' },
					'100%': { transform: 'translateX(10px) rotate(-2deg)' },
				}, /* 👈 vírgula aqui */
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				'slide-up': {
					'0%': { opacity: '0', transform: 'translateY(20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' },
				},
				'scale-in': {
					'0%': { opacity: '0', transform: 'scale(0.95)' },
					'100%': { opacity: '1', transform: 'scale(1)' },
				},
				'pulse-beat': {
					'0%, 100%': { transform: 'scale(1)', opacity: '1' },
					'50%': { transform: 'scale(1.05)', opacity: '0.8' },
				},
				'float-music': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'33%': { transform: 'translateY(-8px) rotate(2deg)' },
					'66%': { transform: 'translateY(4px) rotate(-1deg)' },
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: '0 0 20px hsl(var(--electric-purple) / 0.3)' },
					'50%': { boxShadow: '0 0 40px hsl(var(--electric-purple) / 0.6)' },
				},
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'chicken-walk': 'chicken-walk 2s ease-in-out infinite',
				'egg-bounce': 'egg-bounce 1.5s ease-in-out infinite',
				'feather-float': 'feather-float 3s ease-out forwards',
				'barn-door-open': 'barn-door-open 0.8s ease-out forwards',
				'peck': 'peck 0.3s ease-in-out',
				'fade-in': 'fade-in 0.5s ease-out',
				'slide-up': 'slide-up 0.5s ease-out',
				'scale-in': 'scale-in 0.3s ease-out',
				'pulse-beat': 'pulse-beat 2s ease-in-out infinite',
				'float-music': 'float-music 3s ease-in-out infinite',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
};
