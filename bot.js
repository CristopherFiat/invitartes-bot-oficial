const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');

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
    imagenLia:         BASE + 'lia.webp?alt=media',
    imagenCatalogo:    BASE + 'catalogue_11zon.webp?alt=media&token=e8760350-1beb-4687-ae76-4f57fd40ac4f',
    imagenLucy:        BASE + '16c-scaled_11zon_11zon.webp?alt=media&token=12a0f8e3-6d5b-416c-b70d-7b1ee98d4d0a',
    imagenRafaela:     BASE + '15-scaled_11zon_11zon.webp?alt=media&token=e8ac5e53-6282-4ba8-8735-02d57ffc8622',
    imagenSheyla:      BASE + '11c-scaled_11zon_11zon.webp?alt=media&token=3c729c2e-aaae-41cb-9c7d-d22e70389dc3',
    imagenRemarketingBoda:   BASE + 're_boda.webp?alt=media&token=fc94abde-5f00-40cf-bc18-549484f3b00b',
    imagenRemarketingQuince: BASE + 're_quince.webp?alt=media&token=8e10bc2f-3f2b-4506-aaba-352e3a9e2ac7',
    imagenAbonoBoda:   BASE + 'lalalalalalao%20(1).webp?alt=media&token=4351f9bd-a6f5-48fe-beb0-fadfa8198451',
    imagenAbono15:     BASE + 'lalalalalalao%20(1).webp?alt=media&token=4351f9bd-a6f5-48fe-beb0-fadfa8198451',
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM   = 'https://invitartes.com/plataforma-administracion-eventos/';
const PAYPAL = 'https://paypal.me/CristopherAlvarezG?locale.x=es_XC&country.x=EC';

function esKeywordAsesor(text) {
    const t = text.toLowerCase().trim();
    return t.includes('asesor') || t.includes('hablar con') || t.includes('deseo hablar') ||
           t.includes('quiero hablar') || t.includes('necesito ayuda') || t.includes('agente') ||
           t.includes('persona') || t.includes('humano') || t.includes('speak to') ||
           t.includes('talk to') || t.includes('agent') || t.includes('advisor');
}

function esKeywordGuia(text) {
    const t = text.toLowerCase().trim();
    return t.includes('guía') || t.includes('guia') || t.includes('guide') ||
           t.includes('guia gratuita') || t.includes('guía gratuita');
}

function normalizarNumero(text) {
    const t = text.toLowerCase().trim();
    const mapa = { 'uno':'1','one':'1','dos':'2','two':'2','tres':'3','three':'3','cuatro':'4','four':'4' };
    return mapa[t] || t;
}

function getDatosBancarios(esEspanol) {
    return esEspanol
        ? 'Empezamos con un anticipo inicial de *$170 MXN*, que puedes realizar al siguiente número:\n\n' +
          '🏦 *BBVA Bancomer*\n' +
          'Nombre: Uriel Dominguez Rodriguez\n' +
          'Tarjeta de débito: *4152 3143 4224 4319*\n\n' +
          '🌍 Pagos internacionales — PayPal:\n' +
          '👉 ' + PAYPAL + '\n\n' +
          'El resto nos pagas al entregarte tus invitaciones en máximo *5 días*. ✨\n' +
          '_(Si necesitas antes, avísanos y nos organizamos)_'
        : 'We start with an initial deposit of *$170 MXN*:\n\n' +
          '🏦 *BBVA Bancomer*\n' +
          'Name: Uriel Dominguez Rodriguez\n' +
          'Debit card: *4152 3143 4224 4319*\n\n' +
          '🌍 International payments — PayPal:\n' +
          '👉 ' + PAYPAL + '\n\n' +
          'The rest is paid when we deliver your invitations within *5 days*. ✨\n' +
          '_(If you need them sooner, just let us know)_';
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
    } catch { console.log('⚠️ Error enviando audio'); }
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

async function enviarBienvenidaIngles(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenPlataformas,
            '🎉 Hello! Welcome to *Invitartes* 🇲🇽\n\n' +
            'We don\'t just design digital invitations — we offer you the *most complete event management platform on the market*, one of a kind. 💛\n\n' +
            '👇 Choose an option *by typing the number*:\n\n' +
            '1️⃣ I need information about invitations\n' +
            '2️⃣ Talk to an advisor 👩🏻‍💼\n\n' +
            '✍️ Type only the number to continue.'
        );
    } catch (err) {
        console.error('❌ Error bienvenida EN:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMenuRepetido(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        if (esEspanol === false) {
            await sendText(userId,
                '👇 Please choose an option *by typing the number*:\n\n' +
                '1️⃣ I need information about invitations\n' +
                '2️⃣ Talk to an advisor 👩🏻‍💼\n\n' +
                '✍️ Type only the number to continue.'
            );
        } else {
            await sendText(userId,
                '👇 Por favor elige una de las siguientes opciones *escribiendo el número*:\n\n' +
                '1️⃣ Deseo información sobre las invitaciones\n' +
                '2️⃣ I want information about invitations 🇺🇸\n' +
                '3️⃣ Hablar con un asesor 👩🏻‍💼\n\n' +
                '✍️ Escribe solo el número para continuar.'
            );
        }
    } catch (err) {
        console.error('❌ Error menú repetido:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesorFinal(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, esEspanol !== false
            ? '👩🏻‍💼 No hay problema, en unos momentos uno de nuestros asesores se comunicará contigo. ¡Que tengas un excelente día! ✨'
            : '👩🏻‍💼 No problem, one of our advisors will contact you shortly. Have a great day! ✨');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; }
    } catch (err) {
        console.error('❌ Error asesor final:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

async function enviarMensajeAsesorSolicitado(userId, esEspanol) {
    try {
        await sendText(userId, esEspanol !== false
            ? '👩🏻‍💼 ¡Con gusto! En unos momentos un asesor se comunicará contigo.\n\nPor favor espera, estamos para servirte. ✨'
            : '👩🏻‍💼 Of course! An advisor will contact you shortly.\n\nPlease wait, we are here to help you. ✨');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; estado.respondioPostSecuencia = true; }
    } catch (err) {
        console.error('❌ Error asesor solicitado:', err.message);
    } finally {
        processingUsers.delete(userId);
    }
}

function programarSeguimientos(userId, esEspanol) {
    const now = new Date();

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && !e.seguimiento1Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol !== false
                    ? '¡Hola! 👋 Soy *Carolina* de *Invitartes*, ¿tienes alguna pregunta sobre los paquetes?\n\nEstoy aquí para ayudarte ✨'
                    : 'Hello! 👋 I am *Carolina* from *Invitartes*, do you have any questions about our packages?\n\nI am here to help you ✨');
                e.seguimiento1Enviado = true;
            } catch { console.log('⚠️ Error seg 1'); }
        }
    }, 7 * 60 * 1000);

    setTimeout(async () => {
        const e = userStates.get(userId);
        if (e && e.secuenciaCompleta && !e.respondioPostSecuencia && e.seguimiento1Enviado && !e.seguimiento2Enviado && !e.duenoAtendio) {
            try {
                await sendText(userId, esEspanol !== false
                    ? 'Te dejo algunos ejemplos más por si quieres echarles un vistazo:\n\n• Boda Daniel & Alexandra: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• XV años Rafaela: https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/\n\nRecuerda que con el plan *ÉLITE* obtienes invitaciones ilimitadas y control total de tu evento 👑\n\nCuando estés listo/a:\n📝 ' + FORM + '\n\nQuedo al pendiente 💛'
                    : 'Here are some more examples:\n\n• Wedding Daniel & Alexandra: https://invitartes.com/daniel-alexandra-nuestra-boda-muestra/\n• Sweet 15 Rafaela: https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/\n\nRemember that with the *ELITE* plan you get unlimited invitations 👑\n\nTo get started:\n📝 ' + FORM + '\n\nI am here for you 💛');
                e.seguimiento2Enviado = true;
            } catch { console.log('⚠️ Error seg 2'); }
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
                await sendText(userId, esEspanol !== false
                    ? '¿Cómo estás? 😊 Te saluda *Cristopher* de *Invitartes*.\n\nAyer nos escribiste preguntando por nuestros paquetes, quería saber si tienes alguna duda o si puedo ayudarte en algo. ¡Aquí estamos para lo que necesites! ✨'
                    : 'How are you? 😊 This is *Cristopher* from *Invitartes*.\n\nYesterday you wrote to us asking about our packages — do you have any questions? We are here for whatever you need! ✨');
                e.seguimiento3Enviado = true;
            } catch { console.log('⚠️ Error seg 3'); }
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
                const imgRem = FIREBASE_URLS.imagenRemarketingBoda;
                await sendImage(userId, imgRem, esEspanol !== false
                    ? '¡Hola! 👋 Hace unos días nos escribiste por una invitación digital.\n¿Todavía la estás buscando? Porque tenemos algo nuevo. ✨\n\n🎁 Las próximas 15 reservas reciben *GRATIS* nuestra Página de Fotografías Premium con QR (valorada en $500 MXN).\n\nTe entregamos un PDF personalizado con un código QR para colocar en las mesas de tu evento. Tus invitados lo escanean y suben sus fotos directo a una galería exclusiva. 📸\n\n✨ Todos los momentos especiales en un solo lugar.\n\nPuedes empezar con solo *$170 MXN de anticipo*.\n🛡️ Si no te encanta, te devolvemos tu dinero.\n\n¿Todavía necesitas la invitación para tu evento? 😊'
                    : 'Hello! 👋 A few days ago you wrote to us about a digital invitation.\nAre you still looking for one? ✨\n\n🎁 The next 15 reservations receive our Premium Photo Page with QR *FREE* (valued at $500 MXN).\n\nStart with only *$170 MXN deposit*.\n🛡️ If you don\'t love it, we\'ll refund your money.\n\nDo you still need the invitation? 😊');
                e.seguimiento7dEnviado = true;
            } catch { console.log('⚠️ Error seg 7d'); }
        }
    }, ms7d);
}

async function enviarFlujoPaquetes(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol !== false
            ? '🔗 Aquí puedes conocer cómo funciona nuestra plataforma y las características de cada paquete:\n\n👉 https://invitartes.com/caracteristicas/'
            : '🔗 Here you can learn how our platform works:\n\n👉 https://invitartes.com/caracteristicas/');

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol !== false ? '🎧 Te explicamos brevemente nuestros paquetes en el siguiente audio:' : '🎧 Here is a brief explanation of our packages:');
        await sleep(800);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendAudio(userId, FIREBASE_URLS.audio);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;

        const paquetesText = esEspanol !== false
            ? '🎁 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente *personalizadas* 🎨\n\n*ESSENTIAL* — $1,300 MXN\nBasado en plantilla, una sola invitación para todos, sin fotos, sencillo y bonito.\n👉 (Ejemplo ESSENTIAL) https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $1,800 MXN\nDiseño con nombre y número de pases personalizados + 4 fotos + música y plataforma de envíos.\n👉 (Ejemplo DELUXE) https://invitartes.com/baby-shower-amelia-caridad-muestra-mx/\n\n*ÉLITE* — $2,200 MXN 👑\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + íconos animados, animaciones premium, fecha máxima de confirmación y más.\n👉 (Ejemplo ÉLITE) https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/'
            : '🎁 *Our Packages*\nAll our invitations are completely *personalized* 🎨\n\n*ESSENTIAL* — $1,300 MXN\nTemplate-based, simple and beautiful.\n👉 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* — $1,800 MXN\nCustom design + 4 photos + music and sending platform.\n👉 https://invitartes.com/baby-shower-amelia-caridad-muestra-mx/\n\n*ELITE* — $2,200 MXN 👑\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations and more.\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/';

        await sendImage(userId, FIREBASE_URLS.imagenAbonoBoda, paquetesText);

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId,
            (esEspanol !== false
                ? 'Para iniciar, llena el siguiente formulario — ahí mismo escoges tu paquete:\n📝 ' + FORM + '\n\nO si lo prefieres, envíanos por WhatsApp los detalles.\n\n'
                : 'To start, fill out the following form — there you choose your package:\n📝 ' + FORM + '\n\nOr send us the details via WhatsApp.\n\n') +
            getDatosBancarios(esEspanol !== false)
        );

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol !== false
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

        programarSeguimientos(userId, esEspanol);

    } catch (err) {
        console.error('❌ Error flujo paquetes:', err.message);
    }
}

async function enviarSecuencia(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        const estado = userStates.get(userId);
        if (estado) { estado.esEspanol = esEspanol; }

        await sleep(1500);
        if (userStates.get(userId)?.duenoAtendio) return;

        await sendText(userId, esEspanol !== false
            ? '¡Hola! 👋 Te saluda el equipo de *Invitartes* ✨\n\n¿Sabías que tu invitación puede ser toda una experiencia? 🤩\n\n🎨 Invitaciones completamente *personalizadas*\n🎵 Con música, fotos y videos incluidos\n💬 Tus invitados pueden subir fotos en tiempo real\n✅ Confirmaciones automáticas de asistencia\n🌍 Llega a todo el mundo en segundos\n📊 Plataforma privada para gestionar tu evento\n♾️ En paquetes superiores, *invitaciones ilimitadas*'
            : 'Hello! 👋 Greetings from the *Invitartes* team ✨\n\nDid you know your invitation can be a whole experience? 🤩\n\n🎨 Completely *personalized* invitations\n🎵 With music, photos and videos included\n💬 Your guests can upload photos in real time\n✅ Automatic attendance confirmations\n🌍 Reaches anywhere in the world\n📊 Private platform to manage your event\n♾️ In higher packages, *unlimited invitations*');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSobres, esEspanol !== false
            ? '✨ *Ejemplo real — Boda* ✨\n\n💍 Dos almas, un destino, una historia que comienza... 🌹\n\nEl amor más bonito merece celebrarse de la manera más especial. 💫\n\nConfirma tu asistencia 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-adriana-mx/'
            : '✨ *Real example — Wedding* ✨\n\n💍 Two souls, one destiny... 🌹\n\nConfirm your attendance 👇\n🔗 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-adriana-mx/');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenBoda2, esEspanol !== false
            ? '💌 *Un amor que se viste de blanco y negro...*\n\nHugo & Nickole te invitan a ser parte del día más importante de sus vidas. ✨\n\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/ 🖤🤍'
            : '💌 *A love dressed in black and white...*\n\nHugo & Nickole invite you to be part of the most important day of their lives. ✨\n\n👉 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-mx/ 🖤🤍');

        await sleep(2000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo, esEspanol !== false
            ? '¡Con todo cariño te enviamos nuestro catálogo! 🎉\n\nÉchale un vistazo: https://invitartes.com/catalogo/\n\nPuedes elegir un modelo o creamos un diseño único según tus colores e ideas. 💛'
            : 'Here is our catalog! 🎉\n\nTake a look: https://invitartes.com/catalogo/ 💛');

        await enviarFlujoPaquetes(userId, esEspanol);

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
                            paso: 'bienvenida', esEspanol: null, intentoMenu: 0,
                            secuenciaCompleta: false, respondioPostSecuencia: false,
                            seguimiento1Enviado: false, seguimiento2Enviado: false,
                            seguimiento3Enviado: false, seguimiento7dEnviado: false,
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

                // Keyword asesor en cualquier momento
                if (estado && !estado.duenoAtendio && !estado.conversacionLibre && esKeywordAsesor(messageText)) {
                    processingUsers.set(userId, Date.now());
                    await enviarMensajeAsesorSolicitado(userId, estado.esEspanol !== false);
                    continue;
                }

                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    userStates.set(userId, {
                        paso: 'bienvenida', esEspanol: null, intentoMenu: 0,
                        secuenciaCompleta: false, respondioPostSecuencia: false,
                        seguimiento1Enviado: false, seguimiento2Enviado: false,
                        seguimiento3Enviado: false, seguimiento7dEnviado: false,
                        duenoAtendio: false, conversacionLibre: false
                    });
                    estado = userStates.get(userId);
                    enviarBienvenida(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    continue;
                }

                if (estado.duenoAtendio) continue;

                // Menú inglés (bienvenida_en)
                if (estado.paso === 'bienvenida_en') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, false).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        processingUsers.set(userId, Date.now());
                        await enviarMensajeAsesorSolicitado(userId, false);
                    } else {
                        estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                        processingUsers.set(userId, Date.now());
                        if (estado.intentoMenu === 1) {
                            enviarMenuRepetido(userId, false).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else {
                            await enviarMensajeAsesorFinal(userId, false);
                        }
                    }
                    continue;
                }

                // Menú principal español
                if (estado.paso === 'bienvenida') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now()); estado.esEspanol = true; estado.paso = 'en_secuencia';
                        enviarSecuencia(userId, true).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        processingUsers.set(userId, Date.now()); estado.esEspanol = false; estado.paso = 'bienvenida_en';
                        enviarBienvenidaIngles(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '3') {
                        processingUsers.set(userId, Date.now()); estado.esEspanol = true;
                        await enviarMensajeAsesorSolicitado(userId, true);
                    } else {
                        estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                        processingUsers.set(userId, Date.now());
                        if (estado.intentoMenu === 1) {
                            enviarMenuRepetido(userId, true).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        } else {
                            await enviarMensajeAsesorFinal(userId, true);
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
    console.log('\n🤖 INVITARTES BOT MX v2.0 (Baileys)');
    console.log('🌐 Puerto: ' + PORT);
    startBot();
});

process.on('SIGTERM', () => process.exit(0));
