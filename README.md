# 🤖 InvitArtes WhatsApp Bot (Versión Cloud)

Bot de WhatsApp automatizado para InvitArtes que envía información sobre invitaciones digitales.

## 📋 Características

- ✅ Responde automáticamente a palabras clave
- 📱 Envía videos, audios, imágenes y PDFs
- 🔄 Sistema de estados para evitar spam
- 🌐 Optimizado para deployment en la nube
- 📊 Dashboard web con QR de conexión

## 🚀 Deployment en Railway (RECOMENDADO)

### Opción 1: Desde GitHub (Más fácil)

1. **Sube el código a GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin TU_REPOSITORIO
   git push -u origin main
   ```

2. **Despliega en Railway:**
   - Ve a [railway.app](https://railway.app)
   - Click en "Start a New Project"
   - Selecciona "Deploy from GitHub repo"
   - Autoriza Railway y selecciona tu repositorio
   - Railway detectará automáticamente Node.js
   - Click en "Deploy Now"

3. **Configura el dominio público:**
   - En Railway, ve a tu proyecto
   - Click en "Settings" → "Networking"
   - Click en "Generate Domain"
   - Copia la URL (ej: `tu-bot.railway.app`)

4. **Conecta WhatsApp:**
   - Abre la URL en tu navegador
   - Escanea el QR con WhatsApp
   - ¡Listo! El bot estará activo 24/7

### Opción 2: Desde Railway CLI

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Inicializar proyecto
railway init

# Desplegar
railway up
```

## 🎯 Deployment en Render

1. **Crea una cuenta en [render.com](https://render.com)**

2. **Nuevo Web Service:**
   - Click en "New +" → "Web Service"
   - Conecta tu repositorio de GitHub
   - O usa "Public Git repository" con la URL

3. **Configuración:**
   - **Name:** invitartes-bot
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

4. **Variables de entorno (opcional):**
   ```
   NODE_ENV=production
   ```

5. **Deploy:**
   - Click en "Create Web Service"
   - Espera a que termine el build
   - Abre la URL de tu servicio

6. **Conecta WhatsApp:**
   - Visita tu URL (ej: `tu-bot.onrender.com`)
   - Escanea el QR
   - ¡Listo!

## ⚠️ Consideraciones importantes

### Persistencia de sesión

**IMPORTANTE:** En servicios gratuitos (Railway/Render), la sesión de WhatsApp se puede perder al reiniciar el servicio. Esto significa que:

- Tendrás que escanear el QR nuevamente después de reinicios
- Los servicios gratuitos se duermen por inactividad
- Railway: Se mantiene activo si usas los $5 de crédito mensual
- Render: Se duerme después de 15 min de inactividad

**Solución:** 
- Railway es mejor porque no se duerme (hasta agotar los $5 gratis/mes)
- Para Render, puedes usar servicios como [UptimeRobot](https://uptimerobot.com) para hacer ping cada 5 minutos

### Palabras clave que activan el bot

El bot responde automáticamente cuando detecta estos mensajes (solo la primera vez):
- Saludos: "hola", "buenos días", "buenas tardes", etc.
- Invitaciones: "invitacion", "invitación digital", "quiero una invitación"
- Eventos: "boda", "xv años", "baby shower", "cumpleaños", etc.

## 📊 Monitoreo

### Ver logs en Railway:
```bash
railway logs
```

### Ver logs en Render:
- Ve a tu servicio
- Click en "Logs" en el menú izquierdo

## 🔧 Desarrollo Local

```bash
# Instalar dependencias
npm install

# Ejecutar
npm start

# Abrir navegador
http://localhost:3000
```

## 📁 Estructura del proyecto

```
invitartes-bot/
├── bot.js           # Código principal del bot
├── package.json     # Dependencias
├── .gitignore       # Archivos a ignorar
└── README.md        # Este archivo
```

## 🆘 Solución de problemas

### El bot no responde
- Verifica que el servicio esté activo en Railway/Render
- Revisa los logs para ver errores
- Asegúrate de que WhatsApp esté conectado

### Error "Cannot find module"
- Asegúrate de que `package.json` tenga todas las dependencias
- Railway/Render debe ejecutar `npm install` automáticamente

### El QR no aparece
- Espera 30-60 segundos después del deploy
- Refresca la página
- Verifica los logs

### Sesión expirada constantemente
- Esto es normal en tier gratuito de Render
- Usa Railway para mejor persistencia
- Considera actualizar a plan pago si necesitas 100% uptime

## 💰 Costos

- **Railway:** $5 de crédito gratis/mes (suficiente para uso moderado)
- **Render:** Gratis con limitaciones (se duerme por inactividad)
- **Recomendación:** Railway para producción

## 📞 Soporte

Para dudas sobre InvitArtes:
- WhatsApp: +593 99 380 9643
- Email: invitartesec@gmail.com
- Web: www.invitartes.com

## 📝 Licencia

MIT - InvitArtes 2025
