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

async function enviarBienvenida(userId) {
    try {
        await sendImage(userId, FIREBASE_URLS.imagenLogo,
            '🎉 ¡Hola! Bienvenido/a a nuestro servicio de invitaciones digitales.\n\n' +
            '👇 Elige una de las siguientes opciones *escribiendo el número* correspondiente:\n\n' +
            '1️⃣ Explícame sobre las invitaciones digitales\n' +
            '2️⃣ Hablar con un asesor\n' +
            '3️⃣ Switch to English 🇺🇸\n\n' +
            '✍️ Escribe solo el número *1*, *2* o *3* para continuar.'
        );
    } catch (err) {
        console.error('❌ Error bienvenida:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenuIngles(userId) {
    try {
        await sleep(1000);
        await sendImage(userId, FIREBASE_URLS.imagenLogo,
            'How can I help you today?\n\n' +
            '1️⃣ I want to learn about digital invitations\n' +
            '2️⃣ I prefer to speak with an advisor\n\n' +
            '✍️ Type only the number *1 or 2* to continue.'
        );
    } catch (err) {
        console.error('❌ Error menú inglés:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        console.log('📤 Secuencia: ' + userId + ' | ' + (esEspanol ? 'ES' : 'EN'));

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
                  "*✨ WHAT'S INCLUDED?*\n\n" +
                  '🎨 100% custom design, your style\n' +
                  '🎵 Music, photos and videos included\n' +
                  '💬 All guest messages in one place\n' +
                  '📸 Live collaborative gallery that updates as the event happens\n' +
                  '🎶 Guests request the songs they want to hear\n' +
                  '✅ QR code for RSVP and door check-in on event day\n' +
                  '⬇️ Download photos directly from the platform\n' +
                  '🌍 Share via WhatsApp or social media in seconds'
        );

        await sleep(2000);
        await sendImage(userId, FIREBASE_URLS.imagenSobres,
            esEspanol
                ? '*Ejemplo 1*\n💫 *El amor tiene fecha.*\n\nJosé & María están escribiendo el capítulo más bonito de su historia, y quieren que tú lo vivas con ellos.\n\nEntra a su invitación digital, confirma tu asistencia y prepárate para una celebración inolvidable. 🥂🤍\n\n👉 https://invitarts.com/boda-de-jose-maria/'
                : '*Example 1*\n💫 *Love has a date.*\n\nJosé & María are writing the most beautiful chapter of their story, and they want you to live it with them.\n\nOpen their digital invitation, confirm your attendance and get ready for an unforgettable celebration. 🥂🤍\n\n👉 https://invitarts.com/boda-de-jose-maria/'
        );

        await sleep(2000);
        await sendImage(userId, FIREBASE_URLS.imagenQuinces,
            esEspanol
                ? '*Ejemplo 2*\n👸🏻✨ *Una princesa está a punto de convertirse en reina...*\n\nMilenna cumple XV años y quiere celebrarlo rodeada de las personas que más quiere. ¿Estás listo para ser parte de esta noche inolvidable?\n\nEntra a su invitación digital, confirma tu asistencia y prepárate para una fiesta que se quedará en tu corazón. 🎉🌸\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '*Example 2*\n👸🏻✨ *A princess is about to become a queen...*\n\nMilenna is turning XV and wants to celebrate surrounded by the people she loves most. Are you ready to be part of this unforgettable night?\n\nOpen her digital invitation, confirm your attendance and get ready for a party that will stay in your heart. 🎉🌸\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
        );

        await sleep(2000);
        await sendImage(userId,
            esEspanol ? FIREBASE_URLS.imagenEspanol : FIREBASE_URLS.imagenIngles,
            esEspanol
                ? '🔗 Conoce cómo funciona nuestra plataforma y las características detalladas de cada paquete:\n\n👉 https://invitarts.com/nuestra-plataforma/'
                : '🔗 Learn how our platform works and see the detailed features of each package:\n\n👉 https://invitarts.com/nuestra-plataforma/'
        );

        await sleep(2000);
        await sendText(userId,
            esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n' +
                  '*CLÁSICO — $100 USD*\n' +
                  'Invitación completa basada en plantilla con colores y animaciones personalizadas. *Invitaciones bajo único pedido*, con nombre y número de pases personalizados, plataforma de administración vinculada a google forms, se incluye en las invitaciones: música, Maps, cuenta regresiva, regalos, Google Calendar y más.\n' +
                  '👉 Ejemplo (BODA - Clásico) https://invitarts.com/daniela-santiago/\n\n' +
                  '*PREMIUM — $175 USD* ⭐ _(Más popular)_\n' +
                  'Diseño completamente personalizado con animaciones premium y secciones exclusivas. Formulario de confirmación privado/personalizable, *invitaciones ilimitadas* con nombre, mesas y pases por invitado. *Plataforma privada Premium* con dashboard completo: confirmaciones, asistentes y mensajes en tiempo real, exportación en PDF, QR opcional, hospedaje y música incluidos. Disponible en hasta *2 idiomas*.\n' +
                  '👉 Ejemplo (BODA - Premium) https://invitarts.com/boda-de-marco-veronica-muestra/\n\n' +
                  '*PRESTIGE — $575 USD* 👑 _(Máximo nivel)_\n' +
                  'Página diseñada desde 0 exclusivamente para ti, con *acceso de por vida* e *invitaciones ilimitadas*. Incluye animaciones premium, apertura personalizada, nombre, mesas y número de pases por invitado. Disponible en hasta *4 idiomas*, con secciones, tipografía e íconos a medida. Todo gestionado desde una *Plataforma privada Premium* con sistema completo de administración, menú interactivo y botonería personalizada.\n' +
                  '👉 Ejemplo (BODA - Prestige) https://invitarts.com/boda-de-cristopher-carolina/'
                : '🎁 *Our Packages*\n\n' +
                  '*CLASSIC — $100 USD*\n' +
                  'Complete template-based invitation with personalized colors and animations. *Invitations per single order*, with personalized name and number of passes, administration platform linked to google forms, included in invitations: music, Maps, countdown, gifts, Google Calendar and more.\n' +
                  '👉 Example (WEDDING - Classic) https://invitarts.com/daniela-santiago/\n\n' +
                  '*PREMIUM — $175 USD* ⭐ _(Most popular)_\n' +
                  'Fully custom design with premium animations and exclusive sections. Private/customizable confirmation form, *unlimited invitations* with name, tables and passes per guest. *Premium private platform* with full dashboard: real-time confirmations, attendees and messages, PDF export, optional QR, hosting and music included. Available in up to *2 languages*.\n' +
                  '👉 Example (WEDDING - Premium) https://invitarts.com/boda-de-marco-veronica-muestra/\n\n' +
                  '*PRESTIGE — $575 USD* 👑 _(Maximum level)_\n' +
                  'Page designed from scratch exclusively for you, with *lifetime access* and *unlimited invitations*. Includes premium animations, custom opening, name, tables and number of passes per guest. Available in up to *4 languages*, with custom sections, typography and icons. All managed from a *Premium private platform* with complete administration system, interactive menu and custom buttons.\n' +
                  '👉 Example (WEDDING - Prestige) https://invitarts.com/boda-de-cristopher-carolina/'
        );

        await sleep(2000);
        await sendText(userId,
            esEspanol
                ? 'En cuanto a la forma de pago, usted elige la que más le convenga:\n\n' +
                  '✅ *Opción 1 — En dos partes:*\n' +
                  'Nos hace llegar $30,00 ahorita para arrancar, y el resto lo cancela tranquilamente cuando le entreguemos su trabajo listo. 🙌\n\n' +
                  '✅ *Opción 2 — Pago completo con descuento:*\n' +
                  'Si prefiere cancelar todo desde el inicio, con gusto le aplicamos un 15% de descuento sobre el valor total. ¡Una muy buena opción para ahorrar! 💰\n\n' +
                  '*Para comenzar, llena el pequeño formulario justo debajo 👇*\n' +
                  '📋 ¡Rápido y fácil, solo 2 minutos!\n' +
                  'Una vez completado, el sistema te enviará automáticamente un correo con los datos bancarios.\n' +
                  'Luego solo *compártenos el comprobante de pago* por aquí y ¡arrancamos! 🚀\n\n' +
                  '📝 ' + FORM
                : 'Regarding payment, you choose the option that works best for you:\n\n' +
                  '✅ *Option 1 — In two parts:*\n' +
                  'Send us $30.00 now to get started, and pay the rest when we deliver your finished work. 🙌\n\n' +
                  '✅ *Option 2 — Full payment with discount:*\n' +
                  'If you prefer to pay everything upfront, we will gladly apply a 15% discount on the total amount. A great way to save! 💰\n\n' +
                  '*To get started, fill out the short form below 👇*\n' +
                  '📋 Quick and easy, only 2 minutes!\n' +
                  'Once completed, the system will automatically send you an email with the bank details.\n' +
                  'Then just *share the payment receipt* with us here and we get started! 🚀\n\n' +
                  '📝 ' + FORM
        );

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
        }
        console.log('✅ Secuencia completa: ' + userId);

        // Seguimiento 1 — 7 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '¡Hola! 👋 Soy *Cisne* de *Invitarts*.\n\n¿Te quedó alguna duda sobre los paquetes o el proceso? Estoy aquí para ayudarte. 😊\n\nCuéntame, ¿para qué tipo de evento estás pensando tu invitación? 🎉'
                            : 'Hello! 👋 I am *Cisne* from *Invitarts*.\n\nDo you have any questions about the packages or the process? I am here to help. 😊\n\nTell me, what type of event are you planning your invitation for? 🎉'
                    );
                    e.seguimiento1Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 1'); }
            }
        }, 7 * 60 * 1000);

        // Seguimiento 2 — 24 horas
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento2Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId,
                        esEspanol
                            ? '💌 Hola de nuevo, soy *Cisne* de *Invitarts*. 👋\n\n' +
                              'Quería contarte un poco más sobre todo lo que incluye tu invitación digital, porque va mucho más allá del diseño:\n\n' +
                              '🪑 *Asignación de mesa* — Cada invitado sabe exactamente dónde sentarse, sin confusiones el día del evento\n' +
                              '📲 *Código QR personalizado* _(opcional)_ — Valida y confirma la asistencia en la puerta de forma rápida y elegante\n' +
                              '🌍 *Plataforma multiidioma* — Tus invitados pueden verla en su propio idioma, sin importar de dónde vengan\n' +
                              '📊 *Panel en tiempo real* — Sabes en todo momento quién confirmó, quién no y cuántos asistirán\n' +
                              '📸 *Álbum compartido* — Tus invitados suben sus fotos directamente desde la invitación\n\n' +
                              'Todo esto en una sola plataforma, desde *$100 USD* — o menos si realizas el pago completo al inicio del proyecto y aprovechas el *15% de descuento* 🎉\n\n' +
                              '¿Te animas a empezar? Llena el formulario y te contactamos enseguida:\n📝 ' + FORM + ' 😊'
                            : '💌 Hello again, I am *Cisne* from *Invitarts*. 👋\n\n' +
                              'I wanted to tell you a little more about everything your digital invitation includes, because it goes far beyond the design:\n\n' +
                              '🪑 *Table assignment* — Each guest knows exactly where to sit, no confusion on the day of the event\n' +
                              '📲 *Custom QR code* _(optional)_ — Validate and confirm attendance at the door quickly and elegantly\n' +
                              '🌍 *Multilingual platform* — Your guests can view it in their own language, no matter where they come from\n' +
                              '📊 *Real-time dashboard* — Know at all times who confirmed, who has not and how many will attend\n' +
                              '📸 *Shared album* — Your guests upload their photos directly from the invitation\n\n' +
                              'All of this in one platform, from *$100 USD* — or less if you pay in full at the start and take advantage of the *15% discount* 🎉\n\n' +
                              'Ready to get started? Fill out the form and we will contact you right away:\n📝 ' + FORM + ' 😊'
                    );
                    e.seguimiento2Enviado = true;
                } catch { console.log('⚠️ Error seguimiento 2'); }
            }
        }, 24 * 60 * 60 * 1000);

    } catch (err) {
        console.error('❌ Error secuencia:', err.message);
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
        console.error('❌ Error asesor:', err.message);
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
                if (message.key.remoteJid?.endsWith('@g.us')) continue;

                const userId = message.key.remoteJid;

                // Si el dueño escribe manualmente, cancelar seguimientos
                if (message.key.fromMe) {
                    const e = userStates.get(userId);
                    if (e) {
                        e.duenoAtendio = true;
                        console.log('👤 Dueño atendió a: ' + userId + ' — seguimientos cancelados');
                    }
                    continue;
                }

                const messageText = (
                    message.message?.conversation ||
                    message.message?.extendedTextMessage?.text || ''
                ).trim();
                if (!messageText) continue;
                console.log('📩 ' + userId + ': "' + messageText + '"');

                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }

                let estado = userStates.get(userId);

                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    userStates.set(userId, {
                        paso: 'bienvenida',
                        esEspanol: null,
                        secuenciaCompleta: false,
                        respondioPostSecuencia: false,
                        seguimiento1Enviado: false,
                        seguimiento2Enviado: false,
                        duenoAtendio: false,
                        intentoMenu: 0,
                        conversacionLibre: false
                    });
                    enviarBienvenida(userId).catch(err => {
                        console.error(err.message);
                        processingUsers.delete(userId);
                    });
                    continue;
                }

                if (estado.paso === 'bienvenida') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, true).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        enviarMensajeAsesor(userId, true).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '3') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = false;
                        estado.paso = 'menu_ingles';
                        enviarMenuIngles(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarBienvenida(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                if (estado.paso === 'menu_ingles') {
                    if (messageText === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, false).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else if (messageText === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.conversacionLibre = true;
                        estado.paso = 'libre';
                        enviarMensajeAsesor(userId, false).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarMenuIngles(userId).catch(err => {
                            console.error(err.message);
                            processingUsers.delete(userId);
                        });
                    }
                    continue;
                }

                if (estado.secuenciaCompleta) {
                    estado.respondioPostSecuencia = true;
                    continue;
                }

                if (estado.conversacionLibre || estado.paso === 'libre') {
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
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Oficial</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px}</style></head><body><div class="c"><h1>✅ Bot Oficial Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2></div></div></body></html>');
    } else if (qrCodeData) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:2rem;border-radius:20px;text-align:center;max-width:500px}h1{color:#667eea}img{max-width:280px}</style></head><body><div class="c"><h1>📱 Conectar WhatsApp</h1><img src="' + qrCodeData + '" alt="QR"><p>Se actualiza cada 5 segundos</p></div></body></html>');
    } else {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:6px solid #f3f3f3;border-top:6px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style></head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando...</h1></div></body></html>');
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTS BOT OFICIAL v4.0 (Baileys)');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
