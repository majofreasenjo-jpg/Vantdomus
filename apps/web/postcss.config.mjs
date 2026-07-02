/**
 * PostCSS — habilita Tailwind v4 SOLO como tooling de build (CP1b Google port).
 * El plugin únicamente expande los archivos CSS que usan directivas de Tailwind
 * (app/components/domi/domi.css); globals.css y el resto del CSS pasan intactos.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
