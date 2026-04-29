const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;

const FIREBASE_URLS = {
    imagenSobres:  'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/SOBRES%20(2).webp?alt=media&token=039116bd-eb91-49f8-bb11-17adcbe45c4e',
    imagenQuinces: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/QUINCES2.webp?alt=media&token=b4218fd0-3f2b-4a9a-bed0-047c70ad265c',
    imagenEspanol: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/espaniolo.webp?alt=media&token=b3436894-5140-40e4-82a4-d9945e1c4999',
    imagenIngles:  'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/ingles.webp?alt=media&token=bcd82e49-0fb7-4c25-8d03-5e83c484a048',
    imagenLogo:    'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/logoinvitarts2.png?alt=media&token=58be72ff-90e4-4d8c-9dbc-0dfda66c4877'
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM = 'https://invitarts.com/formulario/';

async function sendText(jid, text) {
    if (!sock) return;
    await sock.sendMessage(jid, { text });
}

async function sendImage(jid, url, caption) {
    if (!sock) return;
    try {
        await sock.sendMessage(jid, { image: { url }, caption });
    } catch {
        await sendText(jid, caption);
    }
}

async function enviarSelectorIdioma(userId) {
    try {
        await sendText(userId,
            '👋 ¡Hola! / Hi!\n\n' +
            'Por favor, selecciona tu idioma / Please select your language:\n\n' +
            '🇪🇸 *1* — Español\n' +
            '🇺🇸 *2* — English\n\n' +
            '✍️ Escribe solo el número *1* o *2* para continuar.\n' +
            '✍️ Type only the number *1* or *2* to continue.'
        );
    } catch (err) {
        console.error(`❌ Error selector:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenu(userId, esEspanol) {
    try {
        await sleep(1000);
        try {
            await sendImage(userId, FIREBASE_URLS.imagenLogo,
                esEspanol
                    ? '¿En qué te puedo ayudar hoy?\n\n' +
                      '1️⃣ Quiero conocer las invitaciones digitales\n' +
                      '2️⃣ Prefiero hablar con un asesor\n\n' +
                      '✍️ Escribe solo el número *1 o 2* para continuar.'
                    : 'How can I help you today?\n\n' +
                      '1️⃣ I want to learn about digital invitations\n' +
                      '2️⃣ I prefer to speak with an advisor\n\n' +
                      '✍️ Type only the number *1 or 2* to continue.'
            );
        } catch {
            await sendText(userId,
                esEspanol
                    ? '¿En qué te puedo ayudar hoy?\n\n1️⃣ Quiero conocer las invitaciones digitales\n2️⃣ Prefiero hablar con un asesor\n\n✍️ Escribe solo el número *1 o 2* para continuar.'
                    : 'How can I help you today?\n\n1️⃣ I want to learn about digital invitations\n2️⃣ I prefer to speak with an advisor\n\n✍️ Type only the number *1 or 2* to continue.'
            );
        }
    } catch (err) {
        console.error(`❌ Error menú:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        console.log(`📤 Secuencia: ${userId} | ${esEspanol ? 'ES' : 'EN'}`);

        // 1 — Presentación
        await sleep(1500);
        await sendText(userId,
            esEspanol
                ? '¡Hola! 👋 Te saludamos de *Invitarts*, con gusto te contamos sobre nuestras invitaciones digitales ✨\n\n' +
                  '*¿QUÉ INCLUYE TU INVITACIÓN?*\n\n' +
                  '🎨 Diseño 100% personalizado a tu estilo\n' +
                  '🎵 Música, fotos y videos incluidos\n' +
                  '💬 Mensajes de tus invitados en un solo lugar\n' +
                  '📸 Galería colaborativa que se actualiza en vivo mientras el evento sucede\n' +
                  '🎶 Tus invitados piden las canciones que quieren escuchar\n' +
                  '✅ Código QR para confirmar asistencia y validar entrada el día del evento\n' +
                  '⬇️ Descarga de fotos directo desde la plataforma\n' +
                  '🌍 Compártela por WhatsApp o redes en segundos'
                : 'Hello! 👋 Greetings from *Invitarts*, we are happy to tell you about our digital invitations ✨\n\n' +
                  '*✨ WHAT\'S INCLUDED?*\n\n' +
                  '🎨 100% custom design, your style\n' +
                  '🎵 Music, photos and videos included\n' +
                  '💬 All guest messages in one place\n' +
                  '📸 Live collaborative gallery that updates as the event happens\n' +
                  '🎶 Guests request the songs they want to hear\n' +
                  '✅ QR code for RSVP and door check-in on event day\n' +
                  '⬇️ Download photos directly from the platform\n' +
                  '🌍 Share via WhatsApp or social media in seconds'
        );

        // 2 — Ejemplo 1: Boda
        await sleep(2000);
        await sendImage(userId, FIREBASE_URLS.imagenSobres,
            esEspanol
                ? '*Ejemplo 1*\n💫 *El amor tiene fecha.*\n\nJosé & María están escribiendo el capítulo más bonito de su historia, y quieren que tú lo vivas con ellos.\n\nEntra a su invitación digital, confirma tu asistencia y prepárate para una celebración inolvidable. 🥂🤍\n\n👉 https://invitarts.com/boda-de-jose-maria/'
                : '*Example 1*\n💫 *Love has a date.*\n\nJosé & María are writing the most beautiful chapter of their story, and they want you to live it with them.\n\nOpen their digital invitation, confirm your attendance and get ready for an unforgettable celebration. 🥂🤍\n\n👉 https://invitarts.com/boda-de-jose-maria/'
        );

        // 3 — Ejemplo 2: Quinceañera
        await sleep(2000);
        await sendImage(userId, FIREBASE_URLS.imagenQuinces,
            esEspanol
                ? '*Ejemplo 2*\n👸🏻✨ *Una princesa está a punto de convertirse en reina...*\n\nMilenna cumple XV años y quiere celebrarlo rodeada de las personas que más quiere. ¿Estás listo para ser parte de esta noche inolvidable?\n\nEntra a su invitación digital, confirma tu asistencia y prepárate para una fiesta que se quedará en tu corazón. 🎉🌸\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '*Example 2*\n👸🏻✨ *A princess is about to become a queen...*\n\nMilenna is turning XV and wants to celebrate surrounded by the people she loves most. Are you ready to be part of this unforgettable night?\n\nOpen her digital invitation, confirm your attendance and get ready for a party that will stay in your heart. 🎉🌸\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
        );

        // 4 — Plataforma con imagen
        await sleep(2000);
        await sendImage(userId,
            esEspanol ? FIREBASE_URLS.imagenEspanol : FIREBASE_URLS.imagenIngles,
            esEspanol
                ? '🔗 Conoce cómo funciona nuestra plataforma y las características detalladas de cada paquete:\n\n👉 https://invitarts.com/nuestra-plataforma/'
                : '🔗 Learn how our platform works and see the detailed features of each package:\n\n👉 https://invitarts.com/nuestra-plataforma/'
        );

        // 5 — Paquetes
        await sleep(2000);
        await sendText(userId,
            esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n' +
                  '*CLÁSICO — $100 USD*\nInvitación completa basada en plantilla con colores y animaciones personalizadas. Incluye música, Maps, cuenta regresiva, regalos, Google Calendar y más.\n👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PREMIUM — $175 USD* ⭐ _(Más popular)_\nDiseño completamente personalizado, invitaciones ilimitadas, plataforma privada con dashboard, QR, exportar PDF, hospedaje, mesa y canción en tiempo real. Hasta 2 idiomas.\n👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PRESTIGE — $575 USD* 👑 _(Máximo nivel)_\nPágina diseñada desde cero, invitaciones ilimitadas + hasta 4 idiomas, dominio propio opcional, secciones ilimitadas y animación de apertura a medida.\n👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '💳 _Pago único · Sin suscripción_'
                : '🎁 *Our Packages*\n\n' +
                  '*CLASSIC — $100 USD*\nComplete template-based invitation with personalized colors and animations. Includes music, Maps, countdown, gifts, Google Calendar and more.\n👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PREMIUM — $175 USD* ⭐ _(Most popular)_\nFully custom design, unlimited invitations, private platform with dashboard, QR, PDF export, hosting, seating chart and real-time song. Up to 2 languages.\n👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PRESTIGE — $575 USD* 👑 _(Maximum level)_\nPage designed from scratch, unlimited invitations + up to 4 languages, optional custom domain, unlimited sections and custom opening animation.\n👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '💳 _One-time payment · No subscription_'
        );

        // 6 — Formulario
        await sleep(2000);
        await sendText(userId,
            esEspanol
                ? 'Para comenzar con tu invitación, llena nuestro formulario:\n\n📝 ' + FORM + '\n\nUna vez que lo llenes, *avísanos por aquí* para revisarlo en el sistema. ✅\n\n¡Cualquier pregunta con gusto te ayudamos! 😊'
                : 'To get started with your invitation, fill out our form:\n\n📝 ' + FORM + '\n\nOnce you fill it out, *let us know here* so we can check it in the system. ✅\n\nFeel free to ask any questions! 😊'
        );

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
        }
        console.log(`✅ Secuencia completa: ${userId}`);

        // Seguimiento 1 — 7 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 👋 Soy *Cisne* de *Invitarts*.\n\n¿Te quedó alguna duda sobre los paquetes o el proceso? Estoy aquí para ayudarte. 😊\n\nCuéntame, ¿para qué tipo de evento estás pensando tu invitación? 🎉'
                            : 'Hello! 👋 I am *Cisne* from *Invitarts*.\n\nDo you have any questions about the packages or the process? I am here to help. 😊\n\nTell me, what type of event are you planning your invitation for? 🎉'
                    );
                    e.seguimiento1Enviado = true;
                } catch { console.log(`⚠️ Error seguimiento 1`); }
            }
        }, 7 * 60 * 1000);

        // Seguimiento 2 — 14 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '💌 *¿Sabías todo lo que incluye tu invitación digital?*\n\n' +
                              '🪑 *Asignación de mesa* — Cada invitado sabe exactamente dónde sentarse\n' +
                              '📲 *Código QR por invitado* — Valida la asistencia en la puerta\n' +
                              '🌍 *Plataforma multiidioma* — Tus invitados la ven en su propio idioma\n' +
                              '📊 *Panel en tiempo real* — Sabes quién confirmó y quién no\n' +
                              '📸 *Álbum compartido* — Tus invitados suben fotos desde la invitación\n\n' +
                              'Todo desde *$100 USD*. 🎯\n\n¿Listo para empezar?\n📝 ' + FORM
                            : '💌 *Did you know everything your digital invitation includes?*\n\n' +
                              '🪑 *Table assignment* — Each guest knows exactly where to sit\n' +
                              '📲 *QR code per guest* — Validate attendance at the door\n' +
                              '🌍 *Multilingual platform* — Guests view it in their own language\n' +
                              '📊 *Real-time dashboard* — Know who confirmed and who hasn\'t\n' +
                              '📸 *Shared album* — Guests upload photos from the invitation\n\n' +
                              'All from *$100 USD*. 🎯\n\nReady to get started?\n📝 ' + FORM
                    );
                    e.seguimiento2Enviado = true;
                } catch { console.log(`⚠️ Error seguimiento 2`); }
            }
        }, 14 * 60 * 1000);

    } catch (err) {
        console.error(`❌ Error secuencia:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId, esEspanol) {
    try {
        await sleep(1500);
        await sendText(userId,
            esEspanol
                ? '👩🏻‍💼 ¡Perfecto! En unos momentos uno de nuestros asesores se pondrá en contacto contigo.\n\nPor favor permanece en línea 🙏\n\nSerá un placer atenderte. ✨'
                : '👩🏻‍💼 Perfect! One of our advisors will contact you shortly.\n\nPlease stay online 🙏\n\nIt will be a pleasure to assist you. ✨'
        );
    } catch (err) {
        console.error(`❌ Error asesor:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Invitarts Bot Oficial', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('📱 QR generado');
            qrCodeData = await QRCode.toDataURL(qr);
            isConnected = false;
        }

        if (connection === 'close') {
            isConnected = false;
            qrCodeData = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Desconectado. Reconectando:', shouldReconnect);
            if (shouldReconnect) setTimeout(startBot, 3000);
        }

        if (connection === 'open') {
            isConnected = true;
            qrCodeData = '';
            console.log('✅ Bot Oficial conectado!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const message of messages) {
            try {
                if (message.key.fromMe) continue;
                if (message.key.remoteJid?.endsWith('@g.us')) continue;

                const userId = message.key.remoteJid;
                const messageText = (
                    message.message?.conversation ||
                    message.message?.extendedTextMessage?.text || ''
                ).trim();

                if (!messageText) continue;
                console.log(`📩 ${userId}: "${messageText}"`);

                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }

                let estado = userStates.get(userId);

                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    userStates.set(userId, {
                        paso: 'eligiendo_idioma',
                        intentoIdioma: 1,
                        esEspanol: null,
                        secuenciaCompleta: false,
                        respondioPostSecuencia: false,
                        seguimiento1Enviado: false,
                        seguimiento2Enviado: false,
                        intentoMenu: 0,
                        conversacionLibre: false
                    });
                    enviarSelectorIdioma(userId).catch(err => {
                        console.error(err.message);
                        processingUsers.delete(userId);
                    });
                    continue;
                }

                if (estado.paso === 'eligiendo_idioma') {
                    if (messageText === '1' || messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = messageText === '1';
                        estado.paso = 'en_menu';
                        enviarMenu(userId, estado.esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (estado.intentoIdioma >= 2) {
                        processingUsers.set(userId, Date.now());
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        estado.esEspanol = true;
                        await sendText(userId,
                            '👩🏻‍💼 Parece que necesitas ayuda personalizada.\n\nEn unos momentos uno de nuestros asesores se pondrá en contacto contigo. 🙏\n\nSerá un placer atenderte. ✨'
                        );
                        processingUsers.delete(userId);
                    } else {
                        processingUsers.set(userId, Date.now());
                        estado.intentoIdioma = (estado.intentoIdioma || 1) + 1;
                        enviarSelectorIdioma(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                const esEspanol = estado.esEspanol;

                if (estado.paso === 'en_menu') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                        continue;
                    }
                    if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        enviarMensajeAsesor(userId, esEspanol).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                        continue;
                    }
                    processingUsers.set(userId, Date.now());
                    estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                    try {
                        await sendText(userId,
                            esEspanol
                                ? 'Disculpa, no entendí tu mensaje 😊\n\nPor favor escribe *1* o *2* para continuar.'
                                : 'Sorry, I did not understand your message 😊\n\nPlease type *1* or *2* to continue.'
                        );
                        if (estado.intentoMenu >= 2) {
                            estado.conversacionLibre = true;
                            estado.paso = 'libre';
                            await sleep(500);
                            await sendText(userId,
                                esEspanol
                                    ? 'Parece que necesitas ayuda personalizada 😊\nTe conecto con un asesor ahora mismo 👩‍💻'
                                    : 'It seems you need personalized help 😊\nLet me connect you with an advisor right now 👩‍💻'
                            );
                        }
                    } catch (err) {
                        console.error(err.message);
                    } finally {
                        processingUsers.delete(userId);
                    }
                    continue;
                }

                if (estado.secuenciaCompleta) {
                    estado.respondioPostSecuencia = true;
                    console.log(`✅ ${userId} respondió — seguimientos cancelados`);
                    continue;
                }

                if (estado.conversacionLibre || estado.paso === 'libre') {
                    console.log(`💬 ${userId} conversación libre`);
                    continue;
                }

            } catch (err) {
                console.error('❌ Error handler:', err.message);
            }
        }
    });
}

app.get('/', async (req, res) => {
    if (isConnected) {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Oficial Conectado</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px;margin:1rem 0}</style>
        </head><body><div class="c"><h1>✅ Bot Oficial Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2></div></div></body></html>`);
    } else if (qrCodeData) {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar WhatsApp</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:20px}.c{background:white;padding:2rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;max-width:600px}h1{color:#667eea}.q img{max-width:300px}.i{text-align:left;background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0}ol{margin-left:20px}li{margin:10px 0}</style>
        </head><body><div class="c"><h1>📱 Conectar WhatsApp</h1><div class="q"><img src="${qrCodeData}" alt="QR"></div>
        <div class="i"><ol><li>Abre WhatsApp en tu celular</li><li>Ve a Configuración ⚙️</li><li>Toca "Dispositivos Vinculados"</li><li>Escanea el QR</li></ol></div>
        <p>🔄 Se actualiza cada 5 segundos</p></div></body></html>`);
    } else {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando...</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:8px solid #f3f3f3;border-top:8px solid #667eea;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style>
        </head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando Bot...</h1></div></body></html>`);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected, timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🤖 INVITARTS BOT OFICIAL v3.0 (Baileys)`);
    console.log(`🌐 Puerto: ${PORT}`);
    console.log('🚀 Iniciando...\n');
    startBot();
});

process.on('SIGTERM', async () => {
    console.log('⏹️ Cerrando...');
    process.exit(0);
});
