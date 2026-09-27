import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gipe: {
          maroon: '#7d201a',
          gold: '#f59e0b',
          cream: '#fff8ec',
          ink: '#241c1b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
