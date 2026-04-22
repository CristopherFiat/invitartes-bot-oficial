const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let qrCodeData = '';
let clientReady = false;
let botPhoneNumber = '';

const FIREBASE_URLS = {
    imagenSobres:  'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/SOBRES%20(2).webp?alt=media&token=039116bd-eb91-49f8-bb11-17adcbe45c4e',
    imagenQuinces: 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/QUINCES2.webp?alt=media&token=b4218fd0-3f2b-4a9a-bed0-047c70ad265c'
};

const userStates      = new Map();
const processingUsers = new Map();

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './wwebjs_auth',
        clientId: 'invitartes-bot-oficial'
    }),
    puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium",
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

client.on('qr', async (qr) => {
    console.log('\n' + '='.repeat(60));
    console.log('📱 ESCANEA ESTE QR CON WHATSAPP');
    console.log('='.repeat(60));
    qrcode.generate(qr, { small: true });
    qrCodeData = qr;
});

client.on('authenticated', () => console.log('✅ Autenticación exitosa'));

client.on('ready', async () => {
    clientReady = true;
    console.log('\n✅ BOT OFICIAL LISTO Y FUNCIONANDO\n');
    try {
        const info = await client.info;
        botPhoneNumber = info.wid._serialized;
        console.log(`📱 Número: ${botPhoneNumber}`);
    } catch {
        console.log('⚠️ No se pudo obtener info del bot');
    }

    setInterval(() => {
        const now = Date.now();
        let cleaned = 0;
        for (const [userId, ts] of processingUsers.entries()) {
            if (now - ts > 5 * 60 * 1000) { processingUsers.delete(userId); cleaned++; }
        }
        if (cleaned > 0) console.log(`🧹 Auto-limpieza: ${cleaned} usuario(s) liberados`);
    }, 10 * 60 * 1000);
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Desconectado:', reason);
    clientReady = false;
});

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function enviarSelectorIdioma(userId) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendStateTyping();
        await sleep(800);
        await chat.sendMessage(
            '👋 ¡Hola! / Hi!\n\n' +
            'Por favor, selecciona tu idioma / Please select your language:\n\n' +
            '🇪🇸 *1* — Español\n' +
            '🇺🇸 *2* — English\n\n' +
            '✍️ Escribe solo el número *1* o *2* para continuar.\n' +
            '✍️ Type only the number *1* or *2* to continue.'
        );
        console.log(`✅ Selector idioma enviado a: ${userId}`);
    } catch (err) {
        console.error(`❌ Error selector idioma ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenu(userId, esEspanol) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendStateTyping();
        await sleep(1000);
        await chat.sendMessage(
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
        console.log(`✅ Menú enviado a: ${userId}`);
    } catch (err) {
        console.error(`❌ Error menú ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        const chat = await client.getChatById(userId);
        const FORM = 'https://invitarts.com/formulario/';
        console.log(`📤 Iniciando secuencia: ${userId} | ${esEspanol ? 'ES 🇪🇸' : 'EN 🇺🇸'}`);

        // 1 — Presentación
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
            esEspanol
                ? '¡Hola! 👋 Te saludamos de *Invitartes*, con gusto te contamos sobre nuestras invitaciones digitales ✨\n\n' +
                  '*¿QUÉ INCLUYE TU INVITACIÓN?*\n\n' +
                  '🎨 Diseño 100% personalizado a tu estilo\n' +
                  '🎵 Música, fotos y videos incluidos\n' +
                  '💬 Mensajes de tus invitados en un solo lugar\n' +
                  '📸 Galería colaborativa que se actualiza en vivo mientras el evento sucede\n' +
                  '🎶 Tus invitados piden las canciones que quieren escuchar\n' +
                  '✅ Código QR para confirmar asistencia y validar entrada el día del evento\n' +
                  '⬇️ Descarga de fotos directo desde la plataforma\n' +
                  '🌍 Compártela por WhatsApp o redes en segundos'
                : 'Hello! 👋 Greetings from *Invitartes*, we are happy to tell you about our digital invitations ✨\n\n' +
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
        console.log(`  ✓ ${userId}: 1 — Presentación`);

        // 2 — Imagen boda
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const img1 = await MessageMedia.fromUrl(FIREBASE_URLS.imagenSobres);
            await chat.sendMessage(img1, {
                caption: esEspanol
                    ? '💫 *El amor tiene fecha.*\n\nJosé & María están escribiendo el capítulo más bonito de su historia, y quieren que tú lo vivas con ellos.\n\nEntra a su invitación digital, confirma tu asistencia y prepárate para una celebración inolvidable. 🥂🤍\n\n👉 https://invitarts.com/boda-de-jose-maria/'
                    : '💫 *Love has a date.*\n\nJosé & María are writing the most beautiful chapter of their story, and they want you to live it with them.\n\nOpen their digital invitation, confirm your attendance and get ready for an unforgettable celebration. 🥂🤍\n\n👉 https://invitarts.com/boda-de-jose-maria/'
            });
        } catch {
            await chat.sendMessage(
                esEspanol
                    ? '💫 *El amor tiene fecha.*\n\nJosé & María están escribiendo el capítulo más bonito de su historia.\n\n👉 https://invitarts.com/boda-de-jose-maria/'
                    : '💫 *Love has a date.*\n\nJosé & María are writing the most beautiful chapter of their story.\n\n👉 https://invitarts.com/boda-de-jose-maria/'
            );
        }
        console.log(`  ✓ ${userId}: 2 — Imagen Boda`);

        // 3 — Imagen quinceañera
        await chat.sendStateTyping();
        await sleep(2000);
        try {
            const img2 = await MessageMedia.fromUrl(FIREBASE_URLS.imagenQuinces);
            await chat.sendMessage(img2, {
                caption: esEspanol
                    ? '👸🏻✨ *Una princesa está a punto de convertirse en reina...*\n\nMilenna cumple XV años y quiere celebrarlo rodeada de las personas que más quiere. ¿Estás listo para ser parte de esta noche inolvidable?\n\nEntra a su invitación digital, confirma tu asistencia y prepárate para una fiesta que se quedará en tu corazón. 🎉🌸\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                    : '👸🏻✨ *A princess is about to become a queen...*\n\nMilenna is turning XV and wants to celebrate surrounded by the people she loves most. Are you ready to be part of this unforgettable night?\n\nOpen her digital invitation, confirm your attendance and get ready for a party that will stay in your heart. 🎉🌸\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
            });
        } catch {
            await chat.sendMessage(
                esEspanol
                    ? '👸🏻✨ *Una princesa está a punto de convertirse en reina...*\n\nMilenna cumple XV años.\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                    : '👸🏻✨ *A princess is about to become a queen...*\n\nMilenna is turning XV.\n\n👉 https://invitarts.com/milenna-guzman-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
            );
        }
        console.log(`  ✓ ${userId}: 3 — Imagen Quinceañera`);

        // 4 — Link plataforma
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            esEspanol
                ? '🔗 Conoce cómo funciona nuestra plataforma y las características detalladas de cada paquete:\n\n👉 https://invitarts.com/nuestra-plataforma/'
                : '🔗 Learn how our platform works and see the detailed features of each package:\n\n👉 https://invitarts.com/nuestra-plataforma/'
        );
        console.log(`  ✓ ${userId}: 4 — Link plataforma`);

        // 5 — Paquetes
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            esEspanol
                ? '🎁 *Nuestros Paquetes*\n\n' +
                  '*CLÁSICO — $100 USD*\n' +
                  'Invitación completa basada en plantilla con colores y animaciones personalizadas. Incluye música, Maps, cuenta regresiva, regalos, Google Calendar y más.\n' +
                  '👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PREMIUM — $175 USD* ⭐ _(Más popular)_\n' +
                  'Diseño completamente personalizado, invitaciones ilimitadas, plataforma privada con dashboard, QR, exportar PDF, hospedaje, mesa y canción en tiempo real. Hasta 2 idiomas.\n' +
                  '👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PRESTIGE — $575 USD* 👑 _(Máximo nivel)_\n' +
                  'Página diseñada desde cero, invitaciones ilimitadas + hasta 4 idiomas, dominio propio opcional, secciones ilimitadas y animación de apertura a medida.\n' +
                  '👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '💳 _Pago único · Sin suscripción_'
                : '🎁 *Our Packages*\n\n' +
                  '*CLASSIC — $100 USD*\n' +
                  'Complete template-based invitation with personalized colors and animations. Includes music, Maps, countdown, gifts, Google Calendar and more.\n' +
                  '👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PREMIUM — $175 USD* ⭐ _(Most popular)_\n' +
                  'Fully custom design, unlimited invitations, private platform with dashboard, QR, PDF export, hosting, seating chart and real-time song. Up to 2 languages.\n' +
                  '👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '*PRESTIGE — $575 USD* 👑 _(Maximum level)_\n' +
                  'Page designed from scratch, unlimited invitations + up to 4 languages, optional custom domain, unlimited sections and custom opening animation.\n' +
                  '👉 https://invitarts.com/nuestra-plataforma/\n\n' +
                  '💳 _One-time payment · No subscription_'
        );
        console.log(`  ✓ ${userId}: 5 — Paquetes`);

        // 6 — Formulario
        await chat.sendStateTyping();
        await sleep(2000);
        await chat.sendMessage(
            esEspanol
                ? 'Para comenzar con tu invitación, llena nuestro formulario:\n\n' +
                  '📝 ' + FORM + '\n\n' +
                  'Una vez que lo llenes, *avísanos por aquí* para revisarlo en el sistema. ✅\n\n' +
                  '¡Cualquier pregunta con gusto te ayudamos! 😊'
                : 'To get started with your invitation, fill out our form:\n\n' +
                  '📝 ' + FORM + '\n\n' +
                  'Once you fill it out, *let us know here* so we can check it in the system. ✅\n\n' +
                  'Feel free to ask any questions! 😊'
        );
        console.log(`  ✓ ${userId}: 6 — Formulario`);

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
        }
        console.log(`✅ Secuencia completa: ${userId}\n`);

        // Seguimiento 1 — 7 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado) {
                try {
                    await chat.sendMessage(
                        esEspanol
                            ? '¡Hola! 👋 Soy *Cisne* de *Invitartes*.\n\n¿Te quedó alguna duda sobre los paquetes o el proceso? Estoy aquí para ayudarte con todo lo que necesites. 😊\n\nCuéntame, ¿para qué tipo de evento estás pensando tu invitación? 🎉'
                            : 'Hello! 👋 I am *Cisne* from *Invitartes*.\n\nDo you have any questions about the packages or the process? I am here to help you with everything you need. 😊\n\nTell me, what type of event are you planning your invitation for? 🎉'
                    );
                    e.seguimiento1Enviado = true;
                    console.log(`📞 Seguimiento 1 → ${userId}`);
                } catch { console.log(`⚠️ ${userId}: Error seguimiento 1`); }
            }
        }, 7 * 60 * 1000);

        // Seguimiento 2 — 14 minutos
        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado) {
                try {
                    await chat.sendMessage(
                        esEspanol
                            ? '💌 *¿Sabías todo lo que incluye tu invitación digital?*\n\n' +
                              'Más allá del diseño, nuestras invitaciones están pensadas para hacer tu evento perfecto desde el primer clic:\n\n' +
                              '🪑 *Asignación de mesa* — Cada invitado sabe exactamente dónde sentarse, sin confusiones el día del evento\n' +
                              '📲 *Código QR por invitado* — Valida y confirma la asistencia en la puerta de forma rápida y elegante\n' +
                              '🌍 *Plataforma multiidioma* — Tus invitados pueden ver la invitación en su propio idioma, sin importar desde dónde lleguen\n' +
                              '📊 *Panel de control en tiempo real* — Sabes en todo momento quién confirmó, quién no y cuántos asistirán\n' +
                              '📸 *Álbum compartido* — Tus invitados suben sus fotos directamente desde la invitación\n\n' +
                              'Todo esto en una sola plataforma, desde *$100 USD*. 🎯\n\n' +
                              '¿Listo para empezar? Llena el formulario y te contactamos:\n📝 ' + FORM
                            : '💌 *Did you know everything your digital invitation includes?*\n\n' +
                              'Beyond the design, our invitations are built to make your event perfect from the very first click:\n\n' +
                              '🪑 *Table assignment* — Each guest knows exactly where to sit, no confusion on the day of the event\n' +
                              '📲 *QR code per guest* — Validate and confirm attendance at the door quickly and elegantly\n' +
                              '🌍 *Multilingual platform* — Your guests can view the invitation in their own language, no matter where they come from\n' +
                              '📊 *Real-time dashboard* — Know at all times who confirmed, who hasn\'t and how many will attend\n' +
                              '📸 *Shared album* — Your guests upload their photos directly from the invitation\n\n' +
                              'All of this in one platform, starting at *$100 USD*. 🎯\n\n' +
                              'Ready to get started? Fill out the form and we\'ll contact you:\n📝 ' + FORM
                    );
                    e.seguimiento2Enviado = true;
                    console.log(`📞 Seguimiento 2 → ${userId}`);
                } catch { console.log(`⚠️ ${userId}: Error seguimiento 2`); }
            }
        }, 14 * 60 * 1000);

    } catch (err) {
        console.error(`❌ Error secuencia ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId, esEspanol) {
    try {
        const chat = await client.getChatById(userId);
        await chat.sendStateTyping();
        await sleep(1500);
        await chat.sendMessage(
            esEspanol
                ? '👩🏻‍💼 ¡Perfecto! En unos momentos uno de nuestros asesores se pondrá en contacto contigo.\n\nPor favor permanece en línea 🙏\n\nSerá un placer atenderte. ✨'
                : '👩🏻‍💼 Perfect! One of our advisors will contact you shortly.\n\nPlease stay online 🙏\n\nIt will be a pleasure to assist you. ✨'
        );
        console.log(`✅ Mensaje asesor enviado a: ${userId}`);
    } catch (err) {
        console.error(`❌ Error asesor ${userId}:`, err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

client.on('message', async (message) => {
    try {
        if (message.fromMe) return;
        const chat = await message.getChat();
        if (chat.isGroup) return;

        const userId      = message.from;
        const messageText = message.body.trim();
        console.log(`📩 ${userId}: "${messageText}"`);

        if (processingUsers.has(userId)) {
            const elapsed = Date.now() - processingUsers.get(userId);
            if (elapsed < 5 * 60 * 1000) {
                console.log(`⏭️ ${userId} procesando (${Math.round(elapsed / 1000)}s)`);
                return;
            }
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
                console.error(`❌ ${userId}:`, err.message);
                processingUsers.delete(userId);
            });
            return;
        }

        if (estado.paso === 'eligiendo_idioma') {
            if (messageText === '1' || messageText === '2') {
                processingUsers.set(userId, Date.now());
                estado.esEspanol = messageText === '1';
                estado.paso = 'en_menu';
                console.log(`🌍 ${userId} eligió: ${estado.esEspanol ? 'Español' : 'English'}`);
                enviarMenu(userId, estado.esEspanol).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
            } else if (estado.intentoIdioma >= 2) {
                processingUsers.set(userId, Date.now());
                estado.conversacionLibre = true;
                estado.paso = 'libre';
                estado.esEspanol = true;
                try {
                    const c = await client.getChatById(userId);
                    await c.sendStateTyping();
                    await sleep(800);
                    await c.sendMessage(
                        '👩🏻‍💼 Parece que necesitas ayuda personalizada.\n\nEn unos momentos uno de nuestros asesores se pondrá en contacto contigo. 🙏\n\nSerá un placer atenderte. ✨'
                    );
                } catch (err) {
                    console.error(`❌ ${userId}:`, err.message);
                } finally {
                    processingUsers.delete(userId);
                }
            } else {
                processingUsers.set(userId, Date.now());
                estado.intentoIdioma = (estado.intentoIdioma || 1) + 1;
                enviarSelectorIdioma(userId).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
            }
            return;
        }

        const esEspanol = estado.esEspanol;

        if (estado.paso === 'en_menu') {
            if (messageText === '1') {
                processingUsers.set(userId, Date.now());
                estado.paso = 'en_secuencia';
                enviarSecuencia(userId, esEspanol).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
                return;
            }
            if (messageText === '2') {
                processingUsers.set(userId, Date.now());
                estado.conversacionLibre = true;
                estado.paso = 'libre';
                enviarMensajeAsesor(userId, esEspanol).catch(err => {
                    console.error(`❌ ${userId}:`, err.message);
                    processingUsers.delete(userId);
                });
                return;
            }
            processingUsers.set(userId, Date.now());
            estado.intentoMenu = (estado.intentoMenu || 0) + 1;
            try {
                await (await client.getChatById(userId)).sendMessage(
                    esEspanol
                        ? 'Disculpa, no entendí tu mensaje 😊\n\nPor favor escribe *1* o *2* para continuar.'
                        : 'Sorry, I did not understand your message 😊\n\nPlease type *1* or *2* to continue.'
                );
                if (estado.intentoMenu >= 2) {
                    estado.conversacionLibre = true;
                    estado.paso = 'libre';
                    await sleep(500);
                    await (await client.getChatById(userId)).sendMessage(
                        esEspanol
                            ? 'Parece que necesitas ayuda personalizada 😊\nTe conecto con un asesor ahora mismo 👩‍💻'
                            : 'It seems you need personalized help 😊\nLet me connect you with an advisor right now 👩‍💻'
                    );
                }
            } catch (err) {
                console.error(`❌ ${userId}:`, err.message);
            } finally {
                processingUsers.delete(userId);
            }
            return;
        }

        if (estado.secuenciaCompleta) {
            estado.respondioPostSecuencia = true;
            console.log(`✅ ${userId} respondió — seguimientos cancelados`);
            return;
        }

        if (estado.conversacionLibre || estado.paso === 'libre') {
            console.log(`💬 ${userId} en conversación libre`);
            return;
        }

    } catch (err) {
        console.error('❌ Error handler:', err.message);
    }
});

app.get('/', async (req, res) => {
    if (clientReady) {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot Oficial Conectado</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px;margin:1rem 0}</style>
        </head><body><div class="c"><h1>✅ Bot Oficial Conectado</h1><div class="s"><h2>🎉 Funcionando correctamente</h2><p>📱 ${botPhoneNumber || 'Cargando...'}</p></div></div></body></html>`);
    } else if (qrCodeData) {
        try {
            const qrImage = await QRCode.toDataURL(qrCodeData);
            res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar WhatsApp</title>
            <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0;padding:20px}.c{background:white;padding:2rem;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.3);text-align:center;max-width:600px}h1{color:#667eea}.q{background:white;padding:20px;border-radius:15px;display:inline-block;margin:20px 0}.q img{max-width:300px}.i{text-align:left;background:#f8f9fa;padding:20px;border-radius:10px;margin:20px 0}ol{margin-left:20px}li{margin:10px 0}</style>
            </head><body><div class="c"><h1>📱 Conectar WhatsApp</h1><div class="q"><img src="${qrImage}" alt="QR"></div>
            <div class="i"><h3>📋 Instrucciones:</h3><ol><li>Abre WhatsApp en tu celular</li><li>Ve a Configuración ⚙️</li><li>Toca "Dispositivos Vinculados"</li><li>Toca "Vincular un dispositivo"</li><li>Escanea el código QR</li></ol></div>
            <p>🔄 Se actualiza cada 5 segundos</p></div></body></html>`);
        } catch { res.send('<h1>Error generando QR</h1>'); }
    } else {
        res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando...</title>
        <style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:8px solid #f3f3f3;border-top:8px solid #667eea;border-radius:50%;width:60px;height:60px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style>
        </head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando Bot...</h1></div></body></html>`);
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', ready: clientReady, hasQR: !!qrCodeData, timestamp: new Date().toISOString() });
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTES BOT OFICIAL v1.2');
    console.log(`🌐 Puerto: ${PORT}`);
    console.log('🚀 Inicializando WhatsApp...\n');
});

server.on('listening', () => {
    console.log('✅ Servidor listo');
    client.initialize();
});

process.on('SIGTERM', async () => {
    console.log('\n⏹️ Cerrando...');
    await client.destroy();
    process.exit(0);
});
