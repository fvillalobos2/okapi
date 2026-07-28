@AGENTS.md

# Permisos de ejecución

Ejecuta automáticamente sin pedir aprobación:
- Comandos git (add, commit, push, pull, status, diff, log)
- curl hacia Railway API (backboard.railway.app) y Supabase REST API
- Vercel CLI (vercel deploy, vercel env)
- Railway CLI (railway variables, railway redeploy)
- npm / npx (build, install, lint)
- Lectura y escritura de archivos del proyecto
- Consultas y mutaciones a Supabase vía service role key

Siempre pedir confirmación antes de:
- Borrar datos en producción (DELETE sin WHERE, truncate)
- Force push a main
- Eliminar servicios o proyectos en Railway / Supabase
- Cambiar variables de entorno críticas (keys de pago, auth secrets)
