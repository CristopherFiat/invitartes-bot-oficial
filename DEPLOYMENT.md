# 🚀 GUÍA RÁPIDA - DEPLOYMENT EN 5 MINUTOS

## Opción A: Railway (Recomendado - Más estable)

### Paso 1: Preparar el código
```bash
# Si no tienes Git instalado, descárgalo de: https://git-scm.com/

# En la carpeta del proyecto:
git init
git add .
git commit -m "Bot InvitArtes listo"
```

### Paso 2: Subir a GitHub
1. Ve a https://github.com y crea cuenta (si no tienes)
2. Click en "New repository" (botón verde)
3. Nombre: `invitartes-bot`
4. Click "Create repository"
5. Copia los comandos que te muestra y pégalos en tu terminal

**ALTERNATIVA SIN GITHUB:**
Si no quieres usar GitHub, puedes usar Railway CLI:
```bash
npm i -g @railway/cli
railway login
railway init
railway up
```

### Paso 3: Desplegar en Railway
1. Ve a https://railway.app
2. Click "Start a New Project"
3. Login con GitHub
4. Click "Deploy from GitHub repo"
5. Selecciona `invitartes-bot`
6. ¡Railway empezará a desplegar automáticamente!

### Paso 4: Obtener URL pública
1. En Railway, click en tu proyecto
2. Ve a "Settings" → "Networking"
3. Click "Generate Domain"
4. Copia la URL (ejemplo: `invitartes-bot.up.railway.app`)

### Paso 5: Conectar WhatsApp
1. Abre la URL en tu navegador
2. Espera a que aparezca el QR (30-60 segundos)
3. Abre WhatsApp en tu celular
4. Ve a Configuración → Dispositivos Vinculados
5. Escanea el QR
6. ✅ ¡LISTO! Tu bot está funcionando 24/7

---

## Opción B: Render (Gratis pero con limitaciones)

### Paso 1: Subir a GitHub
(Mismo proceso que Railway, pasos 1-2 de arriba)

### Paso 2: Desplegar en Render
1. Ve a https://render.com
2. Crea una cuenta
3. Click "New +" → "Web Service"
4. Click "Connect a repository" → Autoriza GitHub
5. Selecciona `invitartes-bot`

### Paso 3: Configurar
- **Name:** `invitartes-bot`
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Instance Type:** Free

Click "Create Web Service"

### Paso 4: Conectar WhatsApp
1. Espera a que termine el deploy (2-3 minutos)
2. Abre la URL que te da Render (ejemplo: `invitartes-bot.onrender.com`)
3. Escanea el QR con WhatsApp
4. ✅ ¡LISTO!

**⚠️ IMPORTANTE DE RENDER:**
- El servicio se duerme después de 15 min sin actividad
- Cuando alguien escriba, se despertará (tarda ~30 segundos)
- Tendrás que reconectar WhatsApp después de reinicios

---

## 🎯 ¿Cuál elegir?

| Característica | Railway | Render |
|---------------|---------|--------|
| **Precio** | $5 gratis/mes | Gratis |
| **Estabilidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Se duerme** | ❌ No | ✅ Sí (15 min) |
| **Reconectar QR** | Raro | Frecuente |
| **Recomendado para** | Producción | Pruebas |

**MI RECOMENDACIÓN:** Railway (los $5 gratis alcanzan perfectamente para un bot)

---

## ✅ Verificar que funciona

1. Abre la URL de tu bot en el navegador
2. Deberías ver "Bot Conectado" o el QR
3. Envía "hola" desde otro WhatsApp al número del bot
4. Deberías recibir toda la información automáticamente

---

## 🆘 Si algo sale mal

### No aparece el QR
- Espera 1-2 minutos después del deploy
- Refresca la página (F5)
- Revisa los logs en Railway/Render

### Error al desplegar
- Verifica que `package.json` existe
- Asegúrate de haber subido todos los archivos
- Revisa los logs para ver el error específico

### El bot no responde
- Verifica en la URL que diga "Bot Conectado"
- Asegúrate de que WhatsApp esté conectado (QR escaneado)
- Prueba desde otro número (no desde el mismo WhatsApp del bot)

---

## 📱 Mantener el bot activo (Render)

Si usas Render y quieres que no se duerma:

1. Ve a https://uptimerobot.com
2. Crea una cuenta gratis
3. Agrega un monitor:
   - Type: HTTP(s)
   - URL: tu URL de Render
   - Monitoring Interval: 5 minutos

Esto hará ping cada 5 min y evitará que se duerma.

---

## 🎉 ¡Eso es todo!

Tu bot debería estar funcionando. Cualquier duda, revisa el README.md completo.
