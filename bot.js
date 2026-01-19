const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURACIÓN
// ============================================
const app = express();
const PORT = process.env.PORT || 3000; // Puerto dinámico para la nube
let qrCodeData = '';
let clientReady = false;
let botPhoneNumber = '';

// URLs de Firebase Storage
const FIREBASE_URLS = {
    pdfPaquetes: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/caracteristicas2026.pdf?alt=media',
    audio: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    video: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/Promooficialfinal%202%20(3).mp4?alt=media',
    imagenSobres: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/sobres.webp?alt=media',
    imagenLia: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/lia.webp?alt=media'
};

// Estado de conversaciones
const userStates = new Map();

// ============================================
// CLIENTE DE WHATSAPP (OPTIMIZADO PARA NUBE)
// ============================================
const client = new Client({
    authStrategy: new LocalAuth({ 
        dataPath: './.wwebjs_auth',
        clientId: 'invitartes-bot'
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer'
        ],
        // Configuración optimizada para servicios cloud
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});

// ============================================
// EVENTOS DEL CLIENTE
// ============================================

client.on('qr', async (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 ESCANEA ESTE QR CON WHATSAPP');
    console.log('='.repeat(60));
    console.log('\n1. Abre WhatsApp en tu celular');
    console.log('2. Ve a Configuración > Dispositivos Vinculados');
    console.log('3. Toca "Vincular un dispositivo"');
    console.log('4. Escanea el QR en la URL de tu servicio\n');
    
    // Mostrar QR en terminal
    qrcode.generate(qr, { small: true });
    
    // Guardar QR para mostrar en navegador
    qrCodeData = qr;
    
    console.log('\n' + '='.repeat(60) + '\n');
});

client.on('authenticated', () => {
    console.log('✅ Autenticación exitosa');
    console.log('📝 Sesión guardada correctamente');
});

client.on('auth_failure', (error) => {
    console.error('❌ Error de autenticación:', error);
    console.log('\n💡 Puede que necesites reautenticarte');
});

client.on('ready', async () => {
    clientReady = true;
    console.log('\n' + '🎉'.repeat(30));
    console.log('✅ BOT DE INVITARTES LISTO Y FUNCIONANDO');
    console.log('🎉'.repeat(30) + '\n');
    
    try {
        const info = await client.info;
        botPhoneNumber = info.wid._serialized;
        console.log(`📱 Número del bot: ${botPhoneNumber}`);
        console.log(`👤 Nombre: ${info.pushname || 'Sin nombre'}`);
    } catch (error) {
        console.log('⚠️  No se pudo obtener info del bot');
    }
    
    console.log('\n📨 Esperando mensajes...\n');
});

client.on('disconnected', (reason) => {
    console.log('⚠️  Cliente desconectado:', reason);
    console.log('🔄 Reiniciando...');
    clientReady = false;
});

client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Cargando: ${percent}% - ${message}`);
});

// ============================================
// FUNCIONES AUXILIARES
// ============================================

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Palabras clave para activar el bot (solo usuarios nuevos)
function esMensajeDeInicio(text) {
    const triggers = [
        'hola', 'buenos dias', 'buenas tardes', 'buenas noches',
        'buen dia', 'buena tarde', 'buena noche', 'ola', 'holis',
        'invitacion', 'invitación', 'invitacion digital', 'invitación digital',
        'quiero una invitacion', 'quiero una invitación',
        'quisiera una invitacion', 'quisiera una invitación',
        'necesito una invitacion', 'necesito una invitación',
        'evento', 'celebracion', 'celebración', 'boda',
        'xv años', 'xv anos', 'quinceaños', 'quinceanera',
        'baby shower', 'bautizo', 'cumpleaños', 'cumpleanos'
    ];
    
    const textLower = text.toLowerCase().trim();
    return triggers.some(trigger => textLower.includes(trigger));
}

// ============================================
// FUNCIÓN PRINCIPAL: ENVIAR INFORMACIÓN
// ============================================
async function enviarInformacionCompleta(userId) {
    const chat = await client.getChatById(userId);
    
    console.log(`\n📤 Enviando información completa a: ${userId}`);
    
    try {
        // ========== MENSAJE 1 ==========
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage('😊 Con mucho gusto, ahora le explico ✨');
        console.log('  ✓ Mensaje 1/10 enviado');
        
        // ========== MENSAJE 2 - CARACTERÍSTICAS ==========
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            'Le envío algunas de las funciones que puede tener en nuestras invitaciones:\n\n' +
            '💫 *Tu evento, tu estilo:* Diseño 100% personalizado que refleja la esencia de tu celebración\n\n' +
            '📱 *Confirmaciones automáticas:* Olvídate de estar preguntando uno por uno. Tus invitados confirman con un clic y tú lo ves en tiempo real\n\n' +
            '🎵 *Ambiente desde el primer momento:* Música, videos, galerías de fotos... tu invitación cobra vida\n\n' +
            '⏰ *Recordatorios inteligentes:* El sistema se encarga de que nadie olvide tu fecha especial\n\n' +
            '🎁 *Mesa de regalos integrada:* Tus invitados saben exactamente qué regalarte, sin complicaciones\n\n' +
            '📊 *Control total:* Dashboard para ver quiénes confirmaron, cuántos van, cuántos asistieron.\n\n' +
            '♾️ *Sin límites:* Envía a todos tus invitados sin pagar extra por cada uno\n\n' +
            '🌍 *Alcance global:* ¿Familiares en el extranjero? Llegan en segundos, sin costos de envío\n\n' +
            '🔄 *Actualizaciones ilimitadas:* ¿Cambió algo? Edita y todos se enteran al instante.'
        );
        console.log('  ✓ Mensaje 2/10 enviado');
        
        // ========== MENSAJE 3 - IMAGEN SOBRES + LINK ==========
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgSobres = await MessageMedia.fromUrl(FIREBASE_URLS.imagenSobres);
            await chat.sendMessage(imgSobres, undefined, {
                caption: 'Le envío un ejemplo real de nuestras invitaciones:\n\n' +
                         '🔗 *Invitación completa:*\n' +
                         'https://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/'
            });
            console.log('  ✓ Mensaje 3/10 enviado (imagen sobres)');
        } catch (error) {
            console.log('  ⚠️  Error con imagen sobres, enviando solo texto');
            await chat.sendMessage(
                'Le envío un ejemplo real de nuestras invitaciones:\n\n' +
                '🔗 *Invitación completa:*\n' +
                'https://invitartes.com/invitacion-a-la-boda-de-karolina-y-erick-muestra/'
            );
        }
        
        // ========== MENSAJE 4 - IMAGEN LIA + LINK ==========
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const imgLia = await MessageMedia.fromUrl(FIREBASE_URLS.imagenLia);
            await chat.sendMessage(imgLia, undefined, {
                caption: '🔗 *Otro ejemplo:*\n' +
                         'https://invitartes.com/invitacion-a-los-xv-anos-de-lia-muestra/'
            });
            console.log('  ✓ Mensaje 4/10 enviado (imagen Lia)');
        } catch (error) {
            console.log('  ⚠️  Error con imagen Lia, enviando solo texto');
            await chat.sendMessage(
                '🔗 *Otro ejemplo:*\n' +
                'https://invitartes.com/invitacion-a-los-xv-anos-de-lia-muestra/'
            );
        }
        
        // ========== MENSAJE 5 - VIDEO ==========
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('Déjeme enviarle un video corto que resume todo esto 🎥');
        console.log('  ✓ Mensaje 5/10 enviado');
        
        // ========== MENSAJE 6 - VIDEO DESCARGA ==========
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const video = await MessageMedia.fromUrl(FIREBASE_URLS.video);
            await chat.sendMessage(video);
            console.log('  ✓ Mensaje 6/10 enviado (video)');
        } catch (error) {
            console.log('  ⚠️  Error enviando video:', error.message);
            await chat.sendMessage('⚠️ No pude enviar el video, pero puede verlo en nuestros ejemplos de invitaciones.');
        }
        
        // ========== MENSAJE 7 - AUDIO EXPLICATIVO ==========
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('Y si prefiere, aquí tiene un audio donde le explico con más detalle 🎧');
        console.log('  ✓ Mensaje 7/10 enviado');
        
        // ========== MENSAJE 8 - AUDIO DESCARGA ==========
        await chat.sendStateTyping();
        await sleep(1500);
        try {
            const audio = await MessageMedia.fromUrl(FIREBASE_URLS.audio);
            await chat.sendMessage(audio);
            console.log('  ✓ Mensaje 8/10 enviado (audio)');
        } catch (error) {
            console.log('  ⚠️  Error enviando audio:', error.message);
            await chat.sendMessage('⚠️ No pude enviar el audio en este momento.');
        }
        
        // ========== MENSAJE 9 - PDF PAQUETES ==========
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage('📄 Le envío también nuestro catálogo completo con todos los paquetes y precios:');
        console.log('  ✓ Mensaje 9/10 enviado');
        
        // ========== MENSAJE 10 - PDF DESCARGA ==========
        await chat.sendStateTyping();
        await sleep(1500);
        try {
            const pdf = await MessageMedia.fromUrl(FIREBASE_URLS.pdfPaquetes);
            await chat.sendMessage(pdf);
            console.log('  ✓ Mensaje 10/10 enviado (PDF)');
        } catch (error) {
            console.log('  ⚠️  Error enviando PDF:', error.message);
            await chat.sendMessage('⚠️ No pude enviar el PDF, pero puede solicitarlo directamente.');
        }
        
        // ========== MENSAJE FINAL ==========
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            '✨ ¿Le gustaría agendar una reunión para diseñar su invitación personalizada?\n\n' +
            '📞 *Contacto directo:*\n' +
            'WhatsApp: +593 99 380 9643\n' +
            'Email: invitartesec@gmail.com\n\n' +
            '🌐 *Más información:*\n' +
            'www.invitartes.com\n\n' +
            'Estoy aquí para ayudarle con cualquier duda 😊'
        );
        console.log('  ✓ Mensaje final enviado');
        
        console.log('✅ Secuencia completa enviada exitosamente\n');
        
    } catch (error) {
        console.error('❌ Error en la secuencia:', error);
        try {
            await chat.sendMessage(
                '⚠️ Hubo un problema enviando toda la información.\n\n' +
                'Por favor contacte directamente:\n' +
                '📱 +593 99 380 9643\n' +
                '📧 invitartesec@gmail.com'
            );
        } catch (e) {
            console.error('❌ No se pudo enviar mensaje de error:', e);
        }
    }
}

// ============================================
// MANEJADOR DE MENSAJES
// ============================================

client.on('message', async (message) => {
    try {
        // Ignorar mensajes del bot mismo
        if (message.fromMe) return;
        
        // Ignorar mensajes de grupos
        if (message.from.includes('@g.us')) return;
        
        const userId = message.from;
        const messageBody = message.body;
        
        console.log(`\n📩 Mensaje de ${userId}: "${messageBody}"`);
        
        // Verificar si es un usuario nuevo o que ya interactuó
        const yaInteractuo = userStates.has(userId);
        
        if (!yaInteractuo && esMensajeDeInicio(messageBody)) {
            // Usuario nuevo con palabra clave de inicio
            console.log(`🆕 Nuevo usuario detectado: ${userId}`);
            userStates.set(userId, { startTime: Date.now() });
            
            await enviarInformacionCompleta(userId);
        } else if (yaInteractuo) {
            // Usuario que ya recibió información
            console.log(`♻️  Usuario ya conocido: ${userId} - Mensaje ignorado`);
        } else {
            // Usuario nuevo pero sin palabra clave
            console.log(`⏭️  Usuario nuevo sin palabra clave - Mensaje ignorado`);
        }
        
    } catch (error) {
        console.error('❌ Error procesando mensaje:', error);
    }
});

// ============================================
// ENDPOINT PARA HEALTHCHECK
// ============================================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        bot: clientReady ? 'connected' : 'connecting',
        uptime: process.uptime()
    });
});

// ============================================
// ENDPOINT PRINCIPAL
// ============================================
app.get('/', async (req, res) => {
    if (clientReady) {
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>InvitArtes Bot - Conectado</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        padding: 60px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                        max-width: 600px;
                    }
                    h1 { color: #28a745; margin-bottom: 20px; font-size: 2.5em; }
                    .status {
                        background: #d4edda;
                        color: #155724;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                        border-left: 4px solid #28a745;
                    }
                    .info {
                        text-align: left;
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 10px;
                        margin: 20px 0;
                    }
                    .info p {
                        margin: 10px 0;
                        color: #333;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>✅ Bot Conectado</h1>
                    <div class="status">
                        <h2>🤖 InvitArtes WhatsApp Bot</h2>
                        <p style="margin-top: 10px;">Estado: <strong>Activo y funcionando</strong></p>
                    </div>
                    <div class="info">
                        <h3>📱 Información:</h3>
                        <p><strong>Número:</strong> ${botPhoneNumber || 'Conectado'}</p>
                        <p><strong>Estado:</strong> Esperando mensajes</p>
                        <p><strong>Usuarios activos:</strong> ${userStates.size}</p>
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (qrCodeData) {
        try {
            const qrImage = await QRCode.toDataURL(qrCodeData);
            res.send(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>InvitArtes Bot - Escanea QR</title>
                    <meta http-equiv="refresh" content="5">
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body {
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            min-height: 100vh;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            padding: 20px;
                        }
                        .container {
                            background: white;
                            border-radius: 20px;
                            padding: 40px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            text-align: center;
                            max-width: 600px;
                        }
                        h1 { color: #667eea; margin-bottom: 20px; }
                        .qr-container {
                            background: white;
                            padding: 20px;
                            border-radius: 15px;
                            display: inline-block;
                            margin: 20px 0;
                            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                        }
                        .qr-container img {
                            display: block;
                            max-width: 300px;
                            height: auto;
                        }
                        .instructions {
                            text-align: left;
                            background: #f8f9fa;
                            padding: 20px;
                            border-radius: 10px;
                            margin: 20px 0;
                        }
                        .instructions h3 { 
                            color: #667eea; 
                            margin-bottom: 15px;
                        }
                        .instructions ol {
                            margin-left: 20px;
                        }
                        .instructions li {
                            margin: 10px 0;
                            color: #333;
                        }
                        .note {
                            background: #fff3cd;
                            color: #856404;
                            padding: 15px;
                            border-radius: 10px;
                            margin-top: 20px;
                            border-left: 4px solid #ffc107;
                        }
                        .loading {
                            display: inline-block;
                            animation: spin 1s linear infinite;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>📱 Conectar WhatsApp</h1>
                        <p style="color: #666; margin-bottom: 20px;">
                            Escanea el código QR con tu celular
                        </p>
                        
                        <div class="qr-container">
                            <img src="${qrImage}" alt="QR Code">
                        </div>
                        
                        <div class="instructions">
                            <h3>📋 Instrucciones:</h3>
                            <ol>
                                <li>Abre <strong>WhatsApp</strong> en tu celular</li>
                                <li>Ve a <strong>Configuración</strong> (⚙️) o <strong>Ajustes</strong></li>
                                <li>Toca <strong>"Dispositivos Vinculados"</strong></li>
                                <li>Toca <strong>"Vincular un dispositivo"</strong></li>
                                <li>Apunta tu cámara al código QR de arriba</li>
                            </ol>
                        </div>
                        
                        <div class="note">
                            <span class="loading">🔄</span>
                            Esta página se actualiza automáticamente cada 5 segundos
                        </div>
                    </div>
                </body>
                </html>
            `);
        } catch (error) {
            res.send('<h1>Error generando QR</h1>');
        }
    } else {
        res.send(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>InvitArtes Bot - Iniciando</title>
                <meta http-equiv="refresh" content="3">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        min-height: 100vh;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 20px;
                    }
                    .container {
                        background: white;
                        border-radius: 20px;
                        padding: 60px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    .loader {
                        border: 8px solid #f3f3f3;
                        border-top: 8px solid #667eea;
                        border-radius: 50%;
                        width: 80px;
                        height: 80px;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 30px;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    h1 { color: #667eea; margin-bottom: 20px; }
                    p { color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="loader"></div>
                    <h1>⏳ Iniciando Bot</h1>
                    <p>Preparando conexión con WhatsApp...</p>
                    <p style="margin-top: 20px; font-size: 0.9em;">
                        Esta página se actualizará automáticamente
                    </p>
                </div>
            </body>
            </html>
        `);
    }
});

// ============================================
// INICIAR SERVIDOR Y BOT
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.clear();
    console.log('\n' + '='.repeat(60));
    console.log('        🤖 INVITARTES WHATSAPP BOT v2.0 (CLOUD)');
    console.log('='.repeat(60) + '\n');
    console.log('🌐 Servidor iniciado en puerto:', PORT);
    console.log('🌍 Ambiente:', process.env.NODE_ENV || 'development');
    console.log('\n='.repeat(60) + '\n');
    console.log('🚀 Inicializando cliente de WhatsApp...\n');
    
    client.initialize();
});

// Manejo de cierre graceful
process.on('SIGINT', async () => {
    console.log('\n\n⏹️  Cerrando bot...');
    await client.destroy();
    console.log('✅ Bot cerrado correctamente');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\n⏹️  Señal de terminación recibida...');
    await client.destroy();
    console.log('✅ Bot cerrado correctamente');
    process.exit(0);
});
