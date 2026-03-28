/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
            },
            colors: {
                neon: {
                    cyan: "#00e5ff",
                    purple: "#a855f7",
                    green: "#22c55e",
                    yellow: "#eab308",
                    red: "#ef4444",
                },
                dark: {
                    base: "#0f0f1a",
                    surface: "#1a1a2e",
                    elevated: "#16213e",
                    border: "#2a2a4a",
                },
            },
            boxShadow: {
                "glow-cyan": "0 0 20px rgba(0, 229, 255, 0.4), 0 0 40px rgba(0, 229, 255, 0.2)",
                "glow-purple":
                    "0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2)",
                "glow-green": "0 0 20px rgba(34, 197, 94, 0.4)",
                "glow-red": "0 0 20px rgba(239, 68, 68, 0.4)",
                "glow-sm-cyan": "0 0 8px rgba(0, 229, 255, 0.5)",
                "glow-sm-purple": "0 0 8px rgba(168, 85, 247, 0.5)",
            },
            keyframes: {
                "pulse-glow": {
                    "0%, 100%": {
                        boxShadow: "0 0 10px rgba(0, 229, 255, 0.3)",
                        opacity: "1",
                    },
                    "50%": {
                        boxShadow: "0 0 30px rgba(0, 229, 255, 0.8), 0 0 60px rgba(0, 229, 255, 0.4)",
                        opacity: "0.8",
                    },
                },
                "cell-fill": {
                    from: { transform: "scale(0) rotate(-15deg)", opacity: "0" },
                    to: { transform: "scale(1) rotate(0deg)", opacity: "1" },
                },
                "win-flash": {
                    "0%, 100%": { backgroundColor: "rgba(0, 229, 255, 0.15)" },
                    "50%": { backgroundColor: "rgba(0, 229, 255, 0.4)" },
                },
                "fade-in": {
                    from: { opacity: "0", transform: "translateY(12px)" },
                    to: { opacity: "1", transform: "translateY(0)" },
                },
                "fade-in-scale": {
                    from: { opacity: "0", transform: "scale(0.95)" },
                    to: { opacity: "1", transform: "scale(1)" },
                },
                "spin-slow": {
                    from: { transform: "rotate(0deg)" },
                    to: { transform: "rotate(360deg)" },
                },
                "matchmaking-pulse": {
                    "0%, 100%": { transform: "scale(1)", opacity: "1" },
                    "50%": { transform: "scale(1.15)", opacity: "0.7" },
                },
            },
            animation: {
                "pulse-glow": "pulse-glow 2s ease-in-out infinite",
                "cell-fill": "cell-fill 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
                "win-flash": "win-flash 0.8s ease-in-out infinite",
                "fade-in": "fade-in 0.4s ease-out forwards",
                "fade-in-scale": "fade-in-scale 0.3s ease-out forwards",
                "spin-slow": "spin-slow 8s linear infinite",
                "matchmaking-pulse": "matchmaking-pulse 1.5s ease-in-out infinite",
            },
        },
    },
    plugins: [],
};
