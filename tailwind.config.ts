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
				// Modern Gaming Colors
				'neon-orange': 'hsl(var(--neon-orange))',
				'neon-purple': 'hsl(var(--neon-purple))',
				'neon-green': 'hsl(var(--neon-green))',
				'neon-blue': 'hsl(var(--neon-blue))',
				'surface': 'hsl(var(--surface))',
				'surface-elevated': 'hsl(var(--surface-elevated))',
				'danger': 'hsl(var(--danger))',
				// Galinheiro Musical custom colors
				'chicken-orange': 'hsl(var(--chicken-orange))',
				'egg-shell': 'hsl(var(--egg-shell))',
				'barn-brown': 'hsl(var(--barn-brown))',
				'feather-white': 'hsl(var(--feather-white))',
				'corn-golden': 'hsl(var(--corn-golden))'
			},
			backgroundImage: {
				'gradient-sunrise': 'var(--gradient-sunrise)',
				'gradient-barn': 'var(--gradient-barn)',
				'gradient-grass': 'var(--gradient-grass)',
				'gradient-sky': 'var(--gradient-sky)'
			},
			boxShadow: {
				'soft': 'var(--shadow-soft)',
				'barn': 'var(--shadow-barn)'
			},
			transitionTimingFunction: {
				'bounce': 'var(--transition-bounce)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'chicken-walk': {
					'0%': { transform: 'translateX(-10px) rotate(-2deg)' },
					'25%': { transform: 'translateX(-5px) rotate(0deg)' },
					'50%': { transform: 'translateX(0px) rotate(2deg)' },
					'75%': { transform: 'translateX(5px) rotate(0deg)' },
					'100%': { transform: 'translateX(10px) rotate(-2deg)' }
				},
				'egg-bounce': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'50%': { transform: 'translateY(-10px) rotate(5deg)' }
				},
				'feather-float': {
					'0%': { transform: 'translateY(0px) rotate(0deg)', opacity: '1' },
					'50%': { transform: 'translateY(-20px) rotate(180deg)', opacity: '0.7' },
					'100%': { transform: 'translateY(-40px) rotate(360deg)', opacity: '0' }
				},
				'barn-door-open': {
					'0%': { transform: 'rotateY(0deg)' },
					'100%': { transform: 'rotateY(-45deg)' }
				},
				'peck': {
					'0%, 100%': { transform: 'translateY(0px)' },
					'50%': { transform: 'translateY(5px)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'chicken-walk': 'chicken-walk 2s ease-in-out infinite',
				'egg-bounce': 'egg-bounce 1.5s ease-in-out infinite',
				'feather-float': 'feather-float 3s ease-out forwards',
				'barn-door-open': 'barn-door-open 0.8s ease-out forwards',
				'peck': 'peck 0.3s ease-in-out'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
