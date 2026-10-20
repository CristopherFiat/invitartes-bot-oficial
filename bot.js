const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');

// Limpiar auth_info corrupto al arrancar
if (fs.existsSync('./auth_info')) {
    fs.rmSync('./auth_info', { recursive: true, force: true });
    console.log('🧹 auth_info limpiado');
}

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;

const BASE = 'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/';
const FIREBASE_URLS = {
    audio:             'https://firebasestorage.googleapis.com/v0/b/invitartes-bot.firebasestorage.app/o/AudioExplicativo.mp3?alt=media',
    imagenPlataformas: BASE + 'plataformas_11zon_11zon%20(1).webp?alt=media&token=ba0c3864-e844-4339-9486-efabeb5528a2',
    imagenSobres:      BASE + 'JAlove.webp?alt=media&token=8ac373fa-f9a6-496e-aa96-7bfd20db85a1',
    imagenBoda2:       BASE + 'negro.webp?alt=media&token=89dd36ae-6e03-45d9-ae4a-8bba71a02315',
    imagenRemarketingBoda:   BASE + 're_boda.webp?alt=media&token=fc94abde-5f00-40cf-bc18-549484f3b00b',
    imagenPaquetesMX:  BASE + 'lalalalalalao%20(1).webp?alt=media&token=4351f9bd-a6f5-48fe-beb0-fadfa8198451',
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM = 'https://invitartes.com/plataforma-administracion-eventos/';
const PAYPAL = 'https://paypal.me/CristopherAlvarezG?locale.x=es_XC&country.x=EC';

const DATOS_BANCARIOS_ES =
    'Empezamos con un anticipo inicial de *$170 MXN*, que puedes realizar al siguiente número:\n\n' +
    '🏦 *BBVA Bancomer*\n' +
    'Nombre: Uriel Dominguez Rodriguez\n' +
    'Tarjeta de débito: *4152 3143 4224 4319*\n\n' +
    '🌍 Pagos internacionales — PayPal:\n' +
    '👉 ' + PAYPAL + '\n\n' +
    'El resto nos pagas al entregarte tus invitaciones en un plazo máximo de *5 días*. ✨\n' +
    '_(Si necesitas antes, avísanos y nos organizamos)_';

const DATOS_BANCARIOS_EN =
    'We start with an initial deposit of *$170 MXN*, which you can send to:\n\n' +
    '🏦 *BBVA Bancomer*\n' +
    'Name: Uriel Dominguez Rodriguez\n' +
    'Debit card: *4152 3143 4224 4319*\n\n' +
    '🌍 International payments — PayPal:\n' +
    '👉 ' + PAYPAL + '\n\n' +
    'The rest is paid when we deliver your invitations within a maximum of *5 days*. ✨\n' +
    '_(If you need them sooner, just let us know and we\'ll arrange it)_';

function esKeywordAsesor(text) {
    const t = text.toLowerCase().trim();
    return t.includes('asesor') || t.includes('hablar con') || t.includes('deseo hablar') ||
           t.includes('quiero hablar') || t.includes('necesito ayuda') || t.includes('agente') ||
           t.includes('persona') || t.includes('humano') || t.includes('speak to') ||
           t.includes('talk to') || t.includes('agent') || t.includes('advisor');
}

function normalizarNumero(text) {
    const t = text.toLowerCase().trim();
    const mapa = {
        'uno': '1', 'one': '1',
        'dos': '2', 'two': '2',
        'tres': '3', 'three': '3',
    };
    return mapa[t] || t;
}

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

async function sendAudio(jid, url) {
    if (!sock) return;
    try {
        await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4', ptt: false });
    } catch {
        console.log('⚠️ Error enviando audio');
    }
}

async function enviarBienvenida(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenPlataformas,
            '🎉 ¡Hola! Bienvenido/a a *Invitartes* 🇲🇽\n\n' +
            '¡Qué gusto tenerte por aquí! 👑💕 En *Invitartes* no solo diseñamos invitaciones digitales — te ofrecemos la *plataforma más completa para gestionar tu evento*, única en su tipo. 💛\n\n' +
            '👇 Elige una opción *escribiendo el número*:\n\n' +
            '1️⃣ Deseo información sobre las invitaciones\n' +
            '2️⃣ I want information about invitations 🇺🇸\n' +
            '3️⃣ Hablar con un asesor 👩🏻‍💼\n\n' +
            '✍️ Escribe solo el número para continuar.'
        );
    } catch (err) {
        console.error('❌ Error bienvenida:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenuRepetido(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId,
            '👇 Por favor elige una de las siguientes opciones *escribiendo el número*:\n\n' +
            '1️⃣ Deseo información sobre las invitaciones\n' +
            '2️⃣ I want information about invitations 🇺🇸\n' +
            '3️⃣ Hablar con un asesor 👩🏻‍💼\n\n' +
            '✍️ Escribe solo el número para continuar.'
        );
    } catch (err) {
        console.error('❌ Error menú repetido:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesor(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? '👩🏻‍💼 ¡Con gusto! En unos momentos uno de nuestros asesores se comunicará contigo.\n\nPor favor espera, estamos para servirte. ✨'
            : '👩🏻‍💼 Of course! One of our advisors will contact you shortly.\n\nPlease wait, we are here to help you. ✨');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; }
    } catch (err) {
        console.error('❌ Error asesor:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        console.log('📤 Secuencia MX: ' + userId + ' | ' + (esEspanol ? 'ES' : 'EN'));

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendText(userId, esEspanol
            ? '¡Hola! 👋 Te saluda el equipo de *Invitartes* ✨\n\n¿Sabías que tu invitación puede ser toda una experiencia? 🤩\n\n🎵 Todos los paquetes incluyen música, fotos y videos\n💬 Tus invitados pueden subir fotos en tiempo real\n✅ Confirmaciones automáticas de asistencia\n🌍 Llega a todo el mundo en segundos\n📊 Plataforma privada para gestionar tu evento\n♾️ En paquetes superiores, *invitaciones ilimitadas*\n\n¡Todo completamente *personalizado* para tu evento! 🎨'
            : 'Hello! 👋 Greetings from the *Invitartes* team ✨\n\nDid you know your invitation can be a whole experience? 🤩\n\n🎵 All packages include music, photos and videos\n💬 Your guests can upload photos in real time\n✅ Automatic attendance confirmations\n🌍 Reaches anywhere in the world\n📊 Private platform to manage your event\n♾️ In higher packages, *unlimited invitations*\n\nEverything completely *personalized* for your event! 🎨');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendImage(userId, FIREBASE_URLS.imagenSobres, esEspanol
            ? '✨ *Ejemplo real — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece celebrarse de la manera más especial. ¡Te invitamos a ser parte de este momento único! 💫\n\nConfirma tu asistencia desde la invitación 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-adriana-mx/'
            : '✨ *Real example — Wedding* ✨\n\n💍 Two souls, one destiny, a story that begins... 🌹\n\nThe most beautiful love deserves to be celebrated in the most special way. 💫\n\nConfirm your attendance inside the invitation 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-adriana-mx/');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendImage(userId, FIREBASE_URLS.imagenBoda2, esEspanol
            ? '💌 *Un amor que se viste de blanco y negro...*\n\nHugo & Nickole te invitan a ser parte del día más importante de sus vidas.\n\n✨ Una historia que comenzó con una mirada, y hoy se convierte en una promesa de amor eterno.\n\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/ 🖤🤍'
            : '💌 *A love dressed in black and white...*\n\nHugo & Nickole invite you to be part of the most important day of their lives.\n\n✨ A story that began with a glance, and today becomes a promise of eternal love.\n\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/ 🖤🤍');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendText(userId, esEspanol
            ? '🔗 Aquí puedes conocer cómo funciona nuestra plataforma y ver las características de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
            : '🔗 Here you can learn how our platform works and see the features of each package:\n\n👉 https://invitartes.com/caracteristicas/');

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol ? '🎧 Te explicamos brevemente nuestros paquetes en el siguiente audio:' : '🎧 Here is a brief explanation of our packages:');
        await sleep(800);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendAudio(userId, FIREBASE_URLS.audio);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        const paquetesText = esEspanol
            ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente *personalizadas* 🎨\n\n*ESSENTIAL* — $1,300 MXN\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $1,800 MXN\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/baby-shower-amelia-caridad-muestra-mx/\n\n*ÉLITE* — $2,200 MXN 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/'
            : '🎁 *Our Packages*\nAll our invitations are completely *personalized* 🎨\n\n*ESSENTIAL* — $1,300 MXN\nTemplate-based, one invitation for everyone, no photos, simple and beautiful.\n👉 (ESSENTIAL Example) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $1,800 MXN\nCustom design with personalized name and number of passes + 4 photos + music and sending platform.\n👉 (DELUXE Example) https://invitartes.com/baby-shower-amelia-caridad-muestra-mx/\n\n*ELITE* — $2,200 MXN 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + animated icons, premium animations, max confirmation date and more.\n👉 (ELITE Example) https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/';

        await sendImage(userId, FIREBASE_URLS.imagenPaquetesMX, paquetesText);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendText(userId, esEspanol
            ? 'Para iniciar con el proceso, por favor llena el siguiente formulario con los datos de tus invitaciones:\n📝 ' + FORM + '\n\nO si lo prefieres, también puedes enviarnos por WhatsApp los detalles y la temática que deseas.\n\n' + DATOS_BANCARIOS_ES
            : 'To start the process, please fill out the following form with your invitation details:\n📝 ' + FORM + '\n\nOr if you prefer, you can also send us the details and theme via WhatsApp.\n\n' + DATOS_BANCARIOS_EN);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? 'Si tienes alguna pregunta, con gusto te ayudamos, ¡estamos para servirte! ✨'
            : 'If you have any questions, we are happy to help you! ✨');

        const estado = userStates.get(userId);
        if (estado) {
            estado.secuenciaCompleta      = true;
            estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado    = false;
            estado.seguimiento2Enviado    = false;
            estado.seguimiento3Enviado    = false;
            estado.seguimiento7dEnviado   = false;
        }
        console.log('✅ Secuencia MX completa: ' + userId);

        const now = new Date();

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId, esEspanol
                        ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tienes alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarte ✨'
                        : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions about our packages?\n\nI am here to help you ✨');
                    e.seguimiento1Enviado = true;
                } catch { console.log('⚠️ Error seguimiento MX 1'); }
            }
        }, 7 * 60 * 1000);

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId, esEspanol
                        ? 'Te dejo algunos ejemplos más por si quieres echarles un vistazo:\n\n• Boda Daniel & Alexandra: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• XV años Rafaela: https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/\n\nRecuerda que con el plan *ÉLITE* obtienes invitaciones ilimitadas y control total de tu evento 👑\n\nCuando estés listo/a:\n📝 ' + FORM + '\n\nQuedo al pendiente 💛'
                        : 'Here are some more examples for you to check out:\n\n• Wedding Daniel & Alexandra: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Sweet 15 Rafaela: https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/\n\nRemember that with the *ELITE* plan you get unlimited invitations and full event control 👑\n\nWhen you are ready:\n📝 ' + FORM + '\n\nI am here for you 💛');
                    e.seguimiento2Enviado = true;
                } catch { console.log('⚠️ Error seguimiento MX 2'); }
            }
        }, 14 * 60 * 1000);

        const manana1145 = new Date(now);
        manana1145.setDate(manana1145.getDate() + 1);
        manana1145.setHours(16, 45, 0, 0);
        const ms1145 = Math.max(manana1145.getTime() - now.getTime(), 60000);

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento3Enviado && !e.duenoAtendio) {
                try {
                    await sendText(userId, esEspanol
                        ? '¿Cómo estás? 😊 Te saluda *Cristopher* de *Invitartes*.\n\nAyer nos escribiste preguntando por nuestros paquetes y quería saber si te quedó alguna duda o si puedo ayudarte con algo. ¡Aquí estamos para lo que necesites! ✨'
                        : 'How are you? 😊 This is *Cristopher* from *Invitartes*.\n\nYesterday you wrote to us asking about our packages — I wanted to know if you have any questions or if I can help you with anything. We are here for whatever you need! ✨');
                    e.seguimiento3Enviado = true;
                } catch { console.log('⚠️ Error seguimiento MX 3'); }
            }
        }, ms1145);

        const siete1215 = new Date(now);
        siete1215.setDate(siete1215.getDate() + 7);
        siete1215.setHours(17, 15, 0, 0);
        const ms7d = Math.max(siete1215.getTime() - now.getTime(), 60000);

        setTimeout(async () => {
            const e = userStates.get(userId);
            if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento7dEnviado && !e.duenoAtendio) {
                try {
                    await sendImage(userId, FIREBASE_URLS.imagenRemarketingBoda, esEspanol
                        ? '¡Hola! 👋 Hace unos días nos escribiste por una invitación digital.\n¿Todavía la estás buscando? Porque tenemos algo nuevo. ✨\n\n🎁 Las próximas 15 reservas reciben *GRATIS* nuestra Página de Fotografías Premium con QR (valorada en $500 MXN).\n\nTe entregamos un PDF personalizado con un código QR para colocar en las mesas de tu evento. Tus invitados lo escanean y suben sus fotos directo a una galería exclusiva. 📸\n\n✨ Todos los momentos especiales en un solo lugar.\n\nPuedes empezar con solo *$170 MXN de anticipo*.\n🛡️ Si no te encanta, te devolvemos tu dinero.\n\n¿Todavía necesitas la invitación para tu evento? 😊'
                        : 'Hello! 👋 A few days ago you wrote to us about a digital invitation.\nAre you still looking for one? ✨\n\n🎁 The next 15 reservations receive our Premium Photo Page with QR *FREE* (valued at $500 MXN).\n\nYour guests scan a QR code and upload their photos directly to an exclusive gallery. 📸\n\nStart with only *$170 MXN deposit*.\n🛡️ If you don\'t love it, we\'ll refund your money.\n\nDo you still need the invitation for your event? 😊');
                    e.seguimiento7dEnviado = true;
                } catch { console.log('⚠️ Error seguimiento MX 7d'); }
            }
        }, ms7d);

    } catch (err) {
        console.error('❌ Error secuencia MX:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version, auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Invitartes Bot MX', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: false,
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) { qrCodeData = await QRCode.toDataURL(qr); isConnected = false; }
        if (connection === 'close') {
            isConnected = false; qrCodeData = '';
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(startBot, 3000);
        }
        if (connection === 'open') { isConnected = true; qrCodeData = ''; console.log('✅ Bot MX conectado!'); }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const message of messages) {
            try {
                if (message.key.remoteJid?.endsWith('@g.us')) continue;
                const userId = message.key.remoteJid;

                if (message.key.fromMe) {
                    let e = userStates.get(userId);
                    if (!e) {
                        userStates.set(userId, {
                            paso: 'bienvenida', esEspanol: null,
                            intentoMenu: 0, secuenciaCompleta: false,
                            respondioPostSecuencia: false, seguimiento1Enviado: false,
                            seguimiento2Enviado: false, seguimiento3Enviado: false,
                            seguimiento7dEnviado: false,
                            duenoAtendio: true, conversacionLibre: false
                        });
                    } else { e.duenoAtendio = true; }
                    console.log('👤 Dueño atendió: ' + userId);
                    continue;
                }

                const messageText = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
                if (!messageText) continue;
                const msgNorm = normalizarNumero(messageText);
                console.log('📩 ' + userId + ': "' + messageText + '"');

                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }

                let estado = userStates.get(userId);

                if (estado && !estado.duenoAtendio && !estado.conversacionLibre && esKeywordAsesor(messageText)) {
                    processingUsers.set(userId, Date.now());
                    await enviarMensajeAsesor(userId, estado.esEspanol !== false);
                    continue;
                }

                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    userStates.set(userId, {
                        paso: 'bienvenida', esEspanol: null,
                        intentoMenu: 0, secuenciaCompleta: false,
                        respondioPostSecuencia: false, seguimiento1Enviado: false,
                        seguimiento2Enviado: false, seguimiento3Enviado: false,
                        seguimiento7dEnviado: false,
                        duenoAtendio: false, conversacionLibre: false
                    });
                    enviarBienvenida(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    continue;
                }

                if (estado.duenoAtendio) continue;

                if (estado.paso === 'bienvenida') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true; estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, true).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = false; estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, false).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '3') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true;
                        enviarMensajeAsesor(userId, true).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else {
                        estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                        processingUsers.set(userId, Date.now());
                        if (estado.intentoMenu === 1) {
                            enviarMenuRepetido(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else {
                            await sendText(userId, '👩🏻‍💼 No hay problema, en unos momentos uno de nuestros asesores se comunicará contigo. ¡Que tengas un excelente día! ✨');
                            estado.conversacionLibre = true; estado.paso = 'libre';
                            processingUsers.delete(userId);
                        }
                    }
                    continue;
                }

                if (estado.secuenciaCompleta) { estado.respondioPostSecuencia = true; continue; }
                if (estado.conversacionLibre || estado.paso === 'libre') continue;

            } catch (err) {
                console.error('❌ Error handler:', err.message);
            }
        }
    });
}

app.get('/', async (req, res) => {
    if (isConnected) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot MX</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px}</style></head><body><div class="c"><h1>✅ Bot MX Conectado</h1><div class="s"><h2>🇲🇽 Funcionando correctamente</h2></div></div></body></html>');
    } else if (qrCodeData) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:2rem;border-radius:20px;text-align:center;max-width:500px}h1{color:#667eea}img{max-width:280px}</style></head><body><div class="c"><h1>📱 Conectar WhatsApp MX</h1><img src="' + qrCodeData + '" alt="QR"><p>Se actualiza cada 5 segundos</p></div></body></html>');
    } else {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:6px solid #f3f3f3;border-top:6px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style></head><body><div class="c"><div class="l"></div><h1>⏳ Iniciando...</h1></div></body></html>');
    }
});

app.get('/health', (req, res) => { res.json({ status: 'ok', connected: isConnected }); });

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n🤖 INVITARTES BOT MX v1.2 (Baileys)');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
