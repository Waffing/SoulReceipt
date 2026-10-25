import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        acid: {
          DEFAULT: "#B8FF29",
          pink: "#FF48B0",
          cyan: "#29E6FF",
          amber: "#FFD23F",
        },
        thermal: {
          paper: "#F7F4EA",
          ink: "#17150F",
          dim: "#6B675C",
        },
      },
      fontFamily: {
        thermal: [
          "JetBrains Mono",
          "Courier New",
          "Noto Sans Mono CJK SC",
          "monospace",
        ],
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px rgba(0,0,0,1)",
        "brutal-sm": "2px 2px 0px 0px rgba(0,0,0,1)",
        "brutal-lg": "8px 8px 0px 0px rgba(0,0,0,1)",
      },
    },
  },
  plugins: [],
};

export default config;
