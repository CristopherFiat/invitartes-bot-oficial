const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = '';
let isConnected = false;
let sock = null;
let clienteContador = 0;

const seguimientoPersona = new Map();

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
    imagenAbono15:     BASE + 'abono15.webp?alt=media&token=8bb13a3b-3d8f-417f-bf28-797dec10bace',
    imagenAbonoBoda:   BASE + 'abonoboda.webp?alt=media&token=50b28afb-0a96-42ee-b74a-91f68691e113',
};

const userStates      = new Map();
const processingUsers = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const FORM   = 'https://invitartes.com/plataforma-administracion-eventos/';
const GUIA   = 'https://drive.google.com/file/d/1HREPiYR6zb-eAIJqGZvLp-EJ3wM-AHgx/view?usp=sharing';
const PAYPAL = 'https://paypal.me/CristopherAlvarezG?locale.x=es_XC&country.x=EC';

function esMexico(phone) {
    return phone && phone.startsWith('52') && phone.length >= 12 && phone.length <= 13;
}
function esAngloparlante(phone) {
    const prefijos = [
        { code: '1', len: 11 }, { code: '44', len: 12 }, { code: '61', len: 11 },
        { code: '64', len: 11 }, { code: '353', len: 12 }, { code: '27', len: 11 },
    ];
    if (!phone) return false;
    return prefijos.some(p => phone.startsWith(p.code) && phone.length === p.len);
}
function esKeywordGuia(text) {
    const t = text.toLowerCase().trim();
    return t.includes('gu\u00eda') || t.includes('guia') || t.includes('guide') ||
           t.includes('quiero la gu\u00eda') || t.includes('quiero la guia') ||
           t.includes('guia gratuita') || t.includes('gu\u00eda gratuita');
}
function esKeywordAsesor(text) {
    const t = text.toLowerCase().trim();
    return t.includes('asesor') || t.includes('hablar con') || t.includes('deseo hablar') ||
           t.includes('quiero hablar') || t.includes('necesito ayuda') || t.includes('agente') ||
           t.includes('persona') || t.includes('humano') || t.includes('speak to') ||
           t.includes('talk to') || t.includes('agent') || t.includes('advisor');
}
function normalizarNumero(text) {
    const t = text.toLowerCase().trim();
    const mapa = { 'uno':'1','one':'1','dos':'2','two':'2','tres':'3','three':'3','cuatro':'4','four':'4','cinco':'5','five':'5' };
    return mapa[t] || t;
}
function getSaludoEcuador() {
    const nowEC = new Date(Date.now() - 5 * 60 * 60 * 1000);
    const hora = nowEC.getUTCHours();
    if (hora >= 5 && hora < 12) return 'Muy buenos d\u00edas';
    if (hora >= 12 && hora < 19) return 'Muy buenas tardes';
    return 'Muy buenas noches';
}
function getFechaLimiteRemarketing() {
    const hoy = new Date();
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const diasRestantes = ultimoDiaMes.getDate() - hoy.getDate();
    if (diasRestantes > 5) {
        const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
        return 'hasta el ' + ultimoDiaMes.getDate() + ' de ' + meses[hoy.getMonth()];
    }
    return 'hasta el 15 del pr\u00f3ximo mes';
}
function getDatosBancarios(phone, esEspanol) {
    if (esMexico(phone)) {
        return esEspanol
            ? 'Empezamos con un abono de *$170 pesos MXN*:\n\n\ud83c\udfe6 *BBVA Bancomer*\nNombre: Uriel Dominguez Rodriguez\nTarjeta de d\u00e9bito: *4152 3143 4224 4319*\n\nO por PayPal:\n\ud83d\udc49 ' + PAYPAL + '\n\nEl resto lo cancela en la entrega. \ud83d\ude0a'
            : 'We start with a deposit of *$170 MXN*:\n\n\ud83c\udfe6 *BBVA Bancomer*\nName: Uriel Dominguez Rodriguez\nDebit card: *4152 3143 4224 4319*\n\nOr via PayPal:\n\ud83d\udc49 ' + PAYPAL + '\n\nThe rest is paid at delivery. \ud83d\ude0a';
    } else if (!esEspanol) {
        return 'We start with a deposit of *$10*.\n\nVia PayPal:\n\ud83d\udc49 ' + PAYPAL + '\n\nThe rest is paid at delivery. \ud83d\ude0a';
    }
    return '\ud83c\udfe6 *Banco Pichincha*\n\ud83d\udcb3 Cuenta: *2216652652*\n\ud83e\udeb6 C\u00e9dula: *1104753122*\n\ud83d\udc64 Titular: *ALVAREZ GRANDA, GUIDO CRISTOPHER*';
}
function getMenuPostPaquetes(opcionesUsadas, esEspanol) {
    const todas = [
        { id: '1', texto: esEspanol ? 'Quiero contratar' : 'I want to hire a package' },
        { id: '2', texto: esEspanol ? 'Ver cat\u00e1logo' : 'See the catalog' },
        { id: '3', texto: esEspanol ? 'Diferencia Deluxe vs \u00c9lite' : 'Difference between Deluxe and Elite' },
        { id: '4', texto: esEspanol ? 'C\u00f3mo funciona la plataforma' : 'How the platform works' },
    ];
    const disponibles = todas.filter(o => !opcionesUsadas.includes(o.id));
    let num = 1;
    const renumeradas = disponibles.map(o => ({ ...o, num: String(num++) }));
    const emojis = ['1\ufe0f\u20e3','2\ufe0f\u20e3','3\ufe0f\u20e3','4\ufe0f\u20e3'];
    const lineas = renumeradas.map((o, i) => emojis[i] + ' ' + o.texto).join('\n');
    return {
        texto: (esEspanol
            ? '\u00bfC\u00f3mo desea proceder ahora? \ud83d\ude0a\n\n\ud83d\udc47 Elija una opci\u00f3n *escribiendo el n\u00famero*:\n\n'
            : 'How would you like to proceed? \ud83d\ude0a\n\n\ud83d\udc47 Choose an option *by typing the number*:\n\n') +
            lineas + '\n\n\u270d\ufe0f ' + (esEspanol ? 'Escriba solo el n\u00famero para continuar.' : 'Type only the number to continue.'),
        mapa: renumeradas
    };
}
async function sendText(jid, text) {
    if (!sock) return;
    await sock.sendMessage(jid, { text });
}
async function sendImage(jid, url, caption) {
    if (!sock) return;
    try { await sock.sendMessage(jid, { image: { url }, caption }); }
    catch { await sendText(jid, caption); }
}
async function sendAudio(jid, url) {
    if (!sock) return;
    try { await sock.sendMessage(jid, { audio: { url }, mimetype: 'audio/mp4', ptt: false }); }
    catch { console.log('\u26a0\ufe0f Error enviando audio'); }
}
async function enviarPreguntaIdioma(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, '\ud83c\udf0d Hello! / \u00a1Hola!\n\nIn which language would you like to be assisted?\n\u00bfEn qu\u00e9 idioma prefiere que le atendamos?\n\n1\ufe0f\u20e3 Espa\u00f1ol\n2\ufe0f\u20e3 English');
    } catch (err) { console.error('\u274c Error pregunta idioma:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarBienvenida(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenPlataformas,
            '\ud83c\udf89 \u00a1Hola! Bienvenido/a a *Invitartes*.\n\n' +
            '\u00a1Qu\u00e9 emoci\u00f3n! \ud83d\udc51\ud83d\udc95 Sabemos que organizar un evento especial puede ser emocionante, pero tambi\u00e9n traer muchas dudas. Por eso en *Invitartes* no solo dise\u00f1amos invitaciones digitales \u2014 te ofrecemos la *plataforma m\u00e1s completa de gesti\u00f3n de eventos del mercado*, \u00fanica en su tipo. \ud83d\udc9b\n\n' +
            '\ud83d\udc47 Elija una opci\u00f3n *escribiendo el n\u00famero*:\n\n' +
            '1\ufe0f\u20e3 Quiero invitaciones para mis XV a\u00f1os \ud83d\udc51\n' +
            '2\ufe0f\u20e3 Quiero invitaciones para Boda \ud83d\udc8d\n' +
            '3\ufe0f\u20e3 Quiero invitaciones para otro evento \u2728\n' +
            '4\ufe0f\u20e3 Quiero la gu\u00eda gratuita \ud83d\udcd6\n\n' +
            '\u270d\ufe0f Escriba solo el n\u00famero para continuar.'
        );
    } catch (err) { console.error('\u274c Error bienvenida:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarBienvenidaIngles(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenPlataformas,
            '\ud83c\udf89 Hello! Welcome to *Invitartes*.\n\nWe don\'t just design digital invitations \u2014 we offer you the *most complete event management platform on the market*. \ud83d\udc9b\n\n' +
            '\ud83d\udc47 Choose an option *by typing the number*:\n\n' +
            '1\ufe0f\u20e3 I need invitations for a Wedding \ud83d\udc8d\n' +
            '2\ufe0f\u20e3 I need invitations for a Sweet 15 \ud83d\udc51\n' +
            '3\ufe0f\u20e3 I need invitations for another event \u2728\n' +
            '4\ufe0f\u20e3 I want the free guide \ud83d\udcd6\n\n' +
            '\u270d\ufe0f Type only the number to continue.'
        );
    } catch (err) { console.error('\u274c Error bienvenida ingl\u00e9s:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarMenuRepetido(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId,
            '\ud83d\udc47 Por favor elija una de las siguientes opciones *escribiendo el n\u00famero*:\n\n' +
            '1\ufe0f\u20e3 Quiero invitaciones para mis XV a\u00f1os \ud83d\udc51\n' +
            '2\ufe0f\u20e3 Quiero invitaciones para Boda \ud83d\udc8d\n' +
            '3\ufe0f\u20e3 Quiero invitaciones para otro evento \u2728\n' +
            '4\ufe0f\u20e3 Quiero la gu\u00eda gratuita \ud83d\udcd6\n\n' +
            '\u270d\ufe0f Escriba solo el n\u00famero para continuar.'
        );
    } catch (err) { console.error('\u274c Error men\u00fa repetido:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarMensajeAsesorFinal(userId) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, '\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbc No hay problema, en unos minutos uno de nuestros asesores se comunicar\u00e1 con usted.\n\nEstamos para servirle, que tenga un excelente d\u00eda. \u2728');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; }
    } catch (err) { console.error('\u274c Error asesor final:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarMensajeAsesorSolicitado(userId, esEspanol) {
    try {
        await sendText(userId, esEspanol
            ? '\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbc \u00a1Con gusto! En unos momentos un asesor se comunicar\u00e1 con usted.\n\nPor favor espere, estamos para servirle. \u2728'
            : '\ud83d\udc69\ud83c\udffb\u200d\ud83d\udcbc Of course! An advisor will contact you shortly.\n\nPlease wait, we are here to help you. \u2728');
        const estado = userStates.get(userId);
        if (estado) { estado.conversacionLibre = true; estado.paso = 'libre'; estado.respondioPostSecuencia = true; }
    } catch (err) { console.error('\u274c Error asesor solicitado:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarGuiaGratuita(userId, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sendText(userId, '\u00a1Aqu\u00ed la tienes! \ud83c\udf89\n\n\ud83d\udcd6 ' + GUIA + '\n\nL\u00e9ela con calma \u2014 son 5 minutos que te van a ahorrar semanas de estr\u00e9s.');
        await sleep(5000);
        if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, 'Por cierto, \u00bfpara qu\u00e9 evento est\u00e1s organizando? As\u00ed te puedo ayudar mejor \ud83d\ude0a\n\n1\ufe0f\u20e3 Boda\n2\ufe0f\u20e3 XV A\u00f1os\n3\ufe0f\u20e3 Otro evento\n\n\u270d\ufe0f Escriba solo el n\u00famero para continuar.');
        const estado = userStates.get(userId);
        if (estado) estado.paso = 'guia_segmento';
    } catch (err) { console.error('\u274c Error gu\u00eda:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarPuenteEmocional(userId, tipoEvento, esEspanol) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        let puente = '';
        if (tipoEvento === 'boda') puente = '\u00a1Qu\u00e9 emoci\u00f3n! \ud83d\udc92 Sabemos lo que es querer que cada detalle quede perfecto \u2014 sobre todo cuando es algo tan importante como tu boda.';
        else if (tipoEvento === 'xv') puente = '\u00a1Qu\u00e9 bonito! \ud83c\udf80 Los XV son un d\u00eda que se recuerda para siempre \u2014 y cada detalle cuenta.';
        else puente = '\u00a1Genial! \ud83c\udf89 Sea el evento que sea, merece una invitaci\u00f3n que trabaje por ti.';
        await sendText(userId, puente);
        await sleep(3000);
        if (userStates.get(userId)?.duenoAtendio) return;
        if (tipoEvento === 'boda') {
            await sendImage(userId, FIREBASE_URLS.imagenSobres, '\u2728 *Ejemplo real 1 \u2014 Boda* \u2728\n\n\ud83d\udc8d Juan Pablo & Adriana\n\ud83d\udd17 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
            await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenBoda2, '\ud83d\udc8c *Ejemplo real 2 \u2014 Boda* \u2728\n\nHugo & Nickole\n\ud83d\udc49 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/');
        } else if (tipoEvento === 'xv') {
            await sendImage(userId, FIREBASE_URLS.imagenLucy, '*Ejemplo 1* \ud83c\udf38\u2728\n\nLucy te invita a vivir su cuento de hadas. \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/');
            await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenRafaela, '*Ejemplo 2* \ud83c\udf38\u2728\n\nRafaela te invita a descubrir c\u00f3mo contin\u00faa su historia. \ud83d\udc51\ud83d\udc95\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/');
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenSobres, '\u2728 *Ejemplo 1 \u2014 Boda* \u2728\n\ud83d\udd17 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
            await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
            await sendImage(userId, FIREBASE_URLS.imagenLia, '\ud83c\udf38 *Ejemplo real 2 \u2014 Quince a\u00f1os* \ud83c\udf38\n\ud83d\udd17 https://invitartes.com/invitacion-xv-anos-lia-haro/');
        }
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, 'Sus invitados confirmaron directo desde ah\u00ed \u2014 sin llamadas, sin perseguir a nadie. \ud83d\ude0a');
        await sleep(5000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, '\u00bfTe gustar\u00eda saber c\u00f3mo funcionan nuestras invitaciones y cu\u00e1nto cuestan? Te explico sin compromiso \ud83d\ude0a\n\n1\ufe0f\u20e3 \u2705 S\u00ed, cu\u00e9ntame\n2\ufe0f\u20e3 \u274c Ahora no, gracias\n\n\u270d\ufe0f Escriba solo el n\u00famero para continuar.');
        const estado = userStates.get(userId);
        if (estado) { estado.paso = 'guia_permiso'; estado.tipoEvento = tipoEvento; }
    } catch (err) { console.error('\u274c Error puente emocional:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function manejarOpcionMenuB(userId, opcionNum, esEspanol, phone) {
    const estado = userStates.get(userId);
    if (!estado || !estado.menuMapa) return;
    const opcionElegida = estado.menuMapa.find(o => o.num === opcionNum);
    if (!opcionElegida) return;
    const idOriginal = opcionElegida.id;
    estado.opcionesUsadas.push(idOriginal);
    estado.respondioPostSecuencia = true;
    processingUsers.set(userId, Date.now());
    if (idOriginal === '1') {
        await sendText(userId,
            '\u00a1Buen\u00edsimo! \ud83c\udf89 Para apartar su lugar necesitamos dos cosas:\n\n' +
            '\ud83d\udcb3 Una transferencia de *$10* a:\n' +
            getDatosBancarios(phone, esEspanol) + '\n\n' +
            '\ud83d\udcdd Y llenar este formulario \u2014 ah\u00ed selecciona el paquete:\n' +
            FORM + '\n\n' +
            '_(No es necesario llenarlo todo, lo m\u00e1s importante es la crom\u00e1tica. Cualquier dato adicional nos lo puede enviar m\u00e1s adelante sin problema \ud83d\ude0a)_\n\n' +
            'El resto lo cancela al momento de la entrega, en m\u00e1ximo *5 d\u00edas*. Si necesita antes, nos avisa. \u2728'
        );
        estado.paso = 'libre'; estado.conversacionLibre = true;
        processingUsers.delete(userId); return;
    }
    if (idOriginal === '2') {
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo,
            esEspanol
                ? '\u00a1Con todo cari\u00f1o le enviamos nuestro cat\u00e1logo! \ud83c\udf89\n\n\u00c9chele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un dise\u00f1o \u00fanico seg\u00fan sus colores e ideas. \ud83d\udc9b'
                : 'Here is our catalog! \ud83c\udf89\n\nTake a look: https://invitartes.com/catalogo/ \ud83d\udc9b');
    }
    if (idOriginal === '3') {
        await sendText(userId, esEspanol
            ? '\ud83d\udc8d *Diferencia entre DELUXE y \u00c9LITE*\n\nVisualmente ambos paquetes se parecen mucho \u2014 la diferencia principal est\u00e1 en la *plataforma* y las *funcionalidades*.\n\n*DELUXE \u2014 $105*\n\u2705 Invitaciones personalizadas con nombre y n\u00famero de pases\n\u2705 Hasta 4 fotos + m\u00fasica\n\u2705 Las invitaciones se generan *por pedido* \u2014 si al inicio solicita 80, se activan las 80. Cada pedido adicional tiene un costo de *$10*.\n\n*\u00c9LITE \u2014 $130 \ud83d\udc51*\n\u2705 Todo lo del Deluxe, m\u00e1s:\n\u267e\ufe0f *Invitaciones ilimitadas*\n\ud83d\udcca Contadores en tiempo real\n\u2705 Registro de asistentes el d\u00eda del evento\n\ud83d\udcac Reconfigura el mensaje de WhatsApp globalmente\n\ud83e\ude91 Establece n\u00famero de mesa\n\ud83d\udcc5 Fecha m\u00e1xima de confirmaci\u00f3n\n\ud83d\udce5 Bandeja de entrada con mensajes de invitados\n\ud83d\udcf8 Galer\u00eda en vivo con fotos de invitados\n\n*En resumen:* si va a invitar a muchas personas y quiere control total, el *\u00c9LITE* es la mejor inversi\u00f3n. \ud83d\udc51'
            : '\ud83d\udc8d *Difference between DELUXE and ELITE*\n\nVisually both look similar \u2014 the main difference is the *platform* and *features*.\n\n*DELUXE \u2014 $105*\n\u2705 Personalized invitations + 4 photos + music\n\u2705 Each additional order costs *$10*.\n\n*ELITE \u2014 $130 \ud83d\udc51*\n\u2705 Everything in Deluxe, plus:\n\u267e\ufe0f *Unlimited invitations*, real-time counters, attendance registration, global WhatsApp reconfiguration, table numbers, confirmation deadline, guest inbox, live photo gallery.\n\n*Best investment if you want full control.* \ud83d\udc51');
    }
    if (idOriginal === '4') {
        await sendText(userId, esEspanol ? '\ud83c\udfa7 Le explicamos brevemente c\u00f3mo funciona nuestra plataforma:' : '\ud83c\udfa7 Here is a brief explanation of how our platform works:');
        await sleep(800);
        await sendAudio(userId, FIREBASE_URLS.audio);
        await sleep(2000);
        await sendText(userId, esEspanol
            ? '\ud83d\udd17 Aqu\u00ed puede ver todas las caracter\u00edsticas detalladas:\n\n\ud83d\udc49 https://invitartes.com/caracteristicas/'
            : '\ud83d\udd17 Here you can see all the detailed features:\n\n\ud83d\udc49 https://invitartes.com/caracteristicas/');
        await sleep(2000);
        const imagenAbono = (estado.tipoEvento === 'xv') ? FIREBASE_URLS.imagenAbono15 : FIREBASE_URLS.imagenAbonoBoda;
        let p2;
        if (estado.tipoEvento === 'xv') {
            p2 = esEspanol
                ? '\ud83c\udf81 *Nuestros Paquetes*\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*\u00c9LITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '\ud83c\udf81 *Our Packages*\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ELITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/';
        } else {
            p2 = esEspanol
                ? '\ud83c\udf81 *Nuestros Paquetes*\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*\u00c9LITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '\ud83c\udf81 *Our Packages*\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ELITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        }
        await sendImage(userId, imagenAbono, p2);
    }
    await sleep(2000);
    if (userStates.get(userId)?.duenoAtendio) return;
    const nuevoMenu = getMenuPostPaquetes(estado.opcionesUsadas, esEspanol);
    if (nuevoMenu.mapa.length === 0) {
        await sendText(userId, esEspanol ? 'Si tiene alguna pregunta m\u00e1s, estamos para servirle. \u2728' : 'If you have any more questions, we are here to help you. \u2728');
        estado.paso = 'libre'; estado.conversacionLibre = true;
    } else {
        await sendText(userId, nuevoMenu.texto);
        estado.menuMapa = nuevoMenu.mapa; estado.intentoMenuB = 0;
    }
    processingUsers.delete(userId);
}
function programarSeguimientos(userId, esEspanol, phone, personaInicial) {
    seguimientoPersona.set(userId, personaInicial);
    const now = new Date();
    setTimeout(async () => {
        const e = userStates.get(userId);
        if (!e || !e.secuenciaCompleta || e.respondioPostSecuencia || e.seguimiento1Enviado || e.duenoAtendio) return;
        try {
            const saludo = getSaludoEcuador();
            const nombre = personaInicial === 'carolina' ? 'Carolina' : 'Cristopher';
            await sendText(userId, saludo + ', le saluda *' + nombre + '* de *Invitartes*. \u00bfTiene alguna pregunta?');
            e.seguimiento1Enviado = true;
        } catch { console.log('\u26a0\ufe0f Error seg 1'); }
    }, 7 * 60 * 1000);
    setTimeout(async () => {
        const e = userStates.get(userId);
        if (!e || !e.secuenciaCompleta || e.respondioPostSecuencia || !e.seguimiento1Enviado || e.seguimiento2Enviado || e.duenoAtendio) return;
        try {
            await sendText(userId, esEspanol ? 'Estamos para servirle \ud83d\ude0a' : 'We are here to help you \ud83d\ude0a');
            e.seguimiento2Enviado = true;
        } catch { console.log('\u26a0\ufe0f Error seg 2'); }
    }, 14 * 60 * 1000);
    const slot = clienteContador % 3;
    const horaSiguiente = new Date(now);
    horaSiguiente.setDate(horaSiguiente.getDate() + 1);
    if (slot === 0) horaSiguiente.setUTCHours(13, 37, 0, 0);
    else if (slot === 1) horaSiguiente.setUTCHours(16, 45, 0, 0);
    else horaSiguiente.setUTCHours(22, 45, 0, 0);
    const msSiguiente = Math.max(horaSiguiente.getTime() - now.getTime(), 60000);
    setTimeout(async () => {
        const e = userStates.get(userId);
        if (!e || !e.secuenciaCompleta || e.respondioPostSecuencia || e.seguimiento3Enviado || e.duenoAtendio) return;
        try {
            const pa = seguimientoPersona.get(userId) || personaInicial;
            const nombreSig = (pa === 'carolina') ? 'Cristopher' : 'Carolina';
            const saludo = getSaludoEcuador();
            await sendText(userId, saludo + ', le saluda *' + nombreSig + '* de *Invitartes*. Ayer nos escribi\u00f3 preguntando por nuestras invitaciones, \u00bfpudo revisarlas? Si tiene alguna duda com\u00e9ntenos, estamos para servirle \ud83d\ude0a');
            e.seguimiento3Enviado = true;
        } catch { console.log('\u26a0\ufe0f Error seg 3'); }
    }, msSiguiente);
    const siete1145 = new Date(now);
    siete1145.setDate(siete1145.getDate() + 7);
    siete1145.setUTCHours(16, 45, 0, 0);
    const ms7d = Math.max(siete1145.getTime() - now.getTime(), 60000);
    setTimeout(async () => {
        const e = userStates.get(userId);
        if (!e || !e.secuenciaCompleta || e.respondioPostSecuencia || e.seguimiento7dEnviado || e.duenoAtendio) return;
        try {
            const imgRem = (e.tipoEvento === 'xv') ? FIREBASE_URLS.imagenRemarketingQuince : FIREBASE_URLS.imagenRemarketingBoda;
            const fechaLimite = getFechaLimiteRemarketing();
            await sendImage(userId, imgRem, esEspanol
                ? '\u00a1Hola! \ud83d\udc4b Hace unos d\u00edas nos escribiste por una invitaci\u00f3n digital.\n\u00bfTodav\u00eda la est\u00e1s buscando? \u2728\n\n\ud83c\udf81 Las pr\u00f3ximas 15 reservas reciben *GRATIS* nuestra P\u00e1gina de Fotograf\u00edas Premium con QR (valorada en $50) \u2014 *' + fechaLimite + '*\n\nPuedes empezar con solo *$10 de abono*.\n\ud83d\udee1\ufe0f Si no te encanta, te devolvemos tu dinero.\n\n\u00bfTodav\u00eda necesitas la invitaci\u00f3n? \ud83d\ude0a'
                : 'Hello! \ud83d\udc4b A few days ago you wrote to us about a digital invitation.\nAre you still looking for one? \u2728\n\nStart with only *$10 deposit*.\n\ud83d\udee1\ufe0f If you don\'t love it, we\'ll refund your money.\n\nDo you still need the invitation? \ud83d\ude0a');
            e.seguimiento7dEnviado = true;
        } catch { console.log('\u26a0\ufe0f Error seg 7d'); }
    }, ms7d);
}
async function enviarFlujoPaquetes(userId, esEspanol, tipoEvento, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? '\ud83d\udd17 Le invitamos a visitar este enlace donde podr\u00e1 conocer c\u00f3mo funciona nuestra plataforma:\n\n\ud83d\udc49 https://invitartes.com/caracteristicas/'
            : '\ud83d\udd17 Visit this link to learn how our platform works:\n\n\ud83d\udc49 https://invitartes.com/caracteristicas/');
        if (esEspanol) {
            await sleep(1500); if (userStates.get(userId)?.duenoAtendio) return;
            await sendText(userId, '\ud83c\udfa7 Le explicamos brevemente nuestros paquetes en el siguiente audio:');
            await sleep(800); if (userStates.get(userId)?.duenoAtendio) return;
            await sendAudio(userId, FIREBASE_URLS.audio);
        }
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        const imagenAbono = (tipoEvento === 'xv') ? FIREBASE_URLS.imagenAbono15 : FIREBASE_URLS.imagenAbonoBoda;
        let paquetesText;
        if (tipoEvento === 'xv') {
            paquetesText = esEspanol
                ? '\ud83c\udf81 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas \ud83c\udfa8\n\n*ESSENTIAL* \u2014 $85\nBasado en plantilla, una sola invitaci\u00f3n para todos, sin fotos, sencillo y bonito.\n\ud83d\udc49 (Ejemplo ESSENTIAL) https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* \u2014 $105\nDise\u00f1o con nombre y n\u00famero de pases personalizados + 4 fotos + m\u00fasica y plataforma de env\u00edos.\n\ud83d\udc49 (Ejemplo DELUXE) https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*\u00c9LITE* \u2014 $130 \ud83d\udc51\nTodo lo del Deluxe + *invitaciones ilimitadas* + hasta 20 fotos + \u00edconos animados, animaciones premium, fecha m\u00e1xima de confirmaci\u00f3n y m\u00e1s.\n\ud83d\udc49 (Ejemplo \u00c9LITE) https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/'
                : '\ud83c\udf81 *Our Packages*\nAll our invitations are completely personalized \ud83c\udfa8\n\n*ESSENTIAL* \u2014 $85\nTemplate-based.\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-muestra/\n\n*DELUXE* \u2014 $105\nCustom design + 4 photos + music.\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-carlita/#\n\n*ELITE* \u2014 $130 \ud83d\udc51\nEverything in Deluxe + *unlimited invitations* + up to 20 photos + premium animations.\n\ud83d\udc49 https://invitarts.com/vivi-zambrano-%e2%9c%a8-mis-xv-una-celebracion-unica-muestra/';
        } else if (tipoEvento === 'boda') {
            paquetesText = esEspanol
                ? '\ud83c\udf81 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas \ud83c\udfa8\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*\u00c9LITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '\ud83c\udf81 *Our Packages*\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/baby-shower-amelia-caridad-muestra/\n\n*ELITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        } else {
            paquetesText = esEspanol
                ? '\ud83c\udf81 *Nuestros Paquetes*\nTodas nuestras invitaciones son completamente personalizadas \ud83c\udfa8\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n*\u00c9LITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
                : '\ud83c\udf81 *Our Packages*\n\n*ESSENTIAL* \u2014 $85\n\ud83d\udc49 https://invitartes.com/mi-bautizo-sol-isabella-muestra/\n\n*DELUXE* \u2014 $105\n\ud83d\udc49 https://invitartes.com/invitacion-graduacion-carlos-auquilla/\n\n*ELITE* \u2014 $130 \ud83d\udc51\n\ud83d\udc49 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/';
        }
        await sendImage(userId, imagenAbono, paquetesText);
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? 'Para iniciar, puede llenar este formulario \u2014 ah\u00ed mismo escoge su paquete:\n\ud83d\udcdd ' + FORM + '\n\n' + getDatosBancarios(phone, esEspanol)
            : 'To get started, fill out this form \u2014 there you choose your package:\n\ud83d\udcdd ' + FORM + '\n\n' + getDatosBancarios(phone, esEspanol));
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? 'Si tiene alguna pregunta, por favor com\u00e9ntenos, estamos para servirle \u2728'
            : 'If you have any questions, please let us know, we are here to help you \u2728');
        await sleep(1500); if (userStates.get(userId)?.duenoAtendio) return;
        const menu = getMenuPostPaquetes([], esEspanol);
        await sendText(userId, menu.texto);
        const estado = userStates.get(userId);
        if (estado) {
            estado.paso = 'flujoB_menu'; estado.menuMapa = menu.mapa;
            estado.opcionesUsadas = []; estado.intentoMenuB = 0;
            estado.secuenciaCompleta = true; estado.respondioPostSecuencia = false;
            estado.seguimiento1Enviado = false; estado.seguimiento2Enviado = false;
            estado.seguimiento3Enviado = false; estado.seguimiento4Enviado = false;
            estado.seguimiento7dEnviado = false;
        }
        const personaInicial = (clienteContador % 2 === 0) ? 'carolina' : 'cristopher';
        programarSeguimientos(userId, esEspanol, phone, personaInicial);
    } catch (err) { console.error('\u274c Error flujo paquetes:', err.message); }
}
async function enviarSecuenciaXV(userId, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        const estado = userStates.get(userId);
        if (estado) { estado.tipoEvento = 'xv'; estado.esEspanol = true; }
        await sleep(1500); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, '\u00a1Qu\u00e9 emoci\u00f3n! \ud83d\udc51\ud83d\udc95\n\nSabemos que organizar unos XV puede ser emocionante, pero tambi\u00e9n traer muchas dudas y organizaci\u00f3n.\n\nPor eso en *Invitartes* no solo dise\u00f1amos invitaciones digitales.\n\nLe ofrecemos una plataforma que le ayuda a mantener todo bajo control para que pueda disfrutar mucho m\u00e1s este momento junto a su hija. \ud83d\udc9b');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, 'Con nuestra plataforma podr\u00e1:\n\n\u2705 Confirmaciones de asistencia en tiempo real.\n\u2705 Control total de invitados.\n\u2705 Invitados informados desde un solo lugar.\n\u2705 Invitaci\u00f3n digital totalmente personalizada.\n\u2705 Galer\u00eda colaborativa de fotograf\u00edas.\n\u2705 Reportes y estad\u00edsticas.\n\n\u2728 Adem\u00e1s, contamos con funciones exclusivas desarrolladas por *Invitartes* que preferimos explicar durante la asesor\u00eda, ya que forman parte del valor diferencial de nuestra plataforma \u2014 *\u00fanica en el mercado*. \ud83d\udc51');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenLucy, '*Ejemplo 1* \ud83c\udf38\u2728\n\n\u00c9rase una vez una princesa que so\u00f1aba con esta noche... Lucy te invita a vivir su cuento de hadas. \ud83d\udc51\n\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-lucy-oficial/');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenRafaela, '*Ejemplo 2* \ud83c\udf38\u2728\n\nRafaela te invita a descubrir c\u00f3mo contin\u00faa su historia. \ud83d\udc51\ud83d\udc95\n\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anios-rafaela/');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSheyla, '*Ejemplo 3* \ud83c\udf38\u2728\n\nSheyla quiere que seas parte de su cuento. \ud83d\udc51\u2728\n\n\ud83d\udc49 https://invitartes.com/erase-una-vez-mis-xv-anos-sheyla-muestra/');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo, '\u00a1Con todo cari\u00f1o le enviamos nuestro cat\u00e1logo! \ud83c\udf89\n\n\u00c9chele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un dise\u00f1o \u00fanico. \ud83d\udc9b');
        await enviarFlujoPaquetes(userId, true, 'xv', phone);
    } catch (err) { console.error('\u274c Error secuencia XV:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function enviarSecuencia(userId, esEspanol, tipoEvento, phone) {
    try {
        const e = userStates.get(userId);
        if (e && e.duenoAtendio) return;
        const estado = userStates.get(userId);
        if (estado) { estado.tipoEvento = tipoEvento; estado.esEspanol = esEspanol; }
        await sleep(1500); if (userStates.get(userId)?.duenoAtendio) return;
        await sendText(userId, esEspanol
            ? '\u00a1Hola! \ud83d\udc4b Le saludamos de *Invitartes*, con gusto le contamos sobre nuestras invitaciones digitales \u2728\n\n\u00bfSab\u00eda que su invitaci\u00f3n puede ser toda una experiencia? \ud83e\udd29\n\n\ud83c\udfa8 Crea invitaciones ilimitadas y personalizadas\n\ud83c\udfb5 Con m\u00fasica, fotos y videos incluidos\n\ud83d\udcac Recibe y ve todos los mensajes de sus invitados\n\ud83d\udcf8 Sus invitados pueden subir sus fotos directamente, \u00a1creando un \u00e1lbum compartido en tiempo real!\n\u2705 Confirmaciones en tiempo real\n\ud83c\udf0d Llega a todo el mundo en segundos\n\ud83d\udcca *Plataforma privada* con contadores en tiempo real, fecha m\u00e1xima de confirmaci\u00f3n, invitaciones ilimitadas y esc\u00e1ner QR opcional'
            : 'Hello! \ud83d\udc4b Greetings from *Invitartes*! \u2728\n\nDid you know your invitation can be a whole experience? \ud83e\udd29\n\n\ud83c\udfa8 Unlimited personalized invitations\n\ud83c\udfb5 Music, photos and videos included\n\ud83d\udcac View all guest messages\n\ud83d\udcf8 Guests upload photos creating a shared album in real time!\n\u2705 Real-time confirmations\n\ud83c\udf0d Reaches anywhere instantly\n\ud83d\udcca Private platform with unlimited invitations and optional QR scanner');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenSobres, esEspanol
            ? '\u2728 *Ejemplo real 1 \u2014 Boda* \u2728\n\n\ud83d\udc8d Dos almas, un destino... \ud83c\udf39\n\ud83d\udd17 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/'
            : '\u2728 *Real example 1 \u2014 Wedding* \u2728\n\n\ud83d\udc8d Two souls, one destiny... \ud83c\udf39\n\ud83d\udd17 https://invitartes.com/invitacion-a-la-boda-de-juan-pablo-y-adriana/');
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        if (tipoEvento === 'otro') {
            await sendImage(userId, FIREBASE_URLS.imagenLia, esEspanol
                ? '\ud83c\udf38 *Ejemplo real 2 \u2014 Quince a\u00f1os* \ud83c\udf38\n\ud83d\udd17 https://invitartes.com/invitacion-xv-anos-lia-haro/'
                : '\ud83c\udf38 *Real example 2 \u2014 Sweet 15* \ud83c\udf38\n\ud83d\udd17 https://invitartes.com/invitacion-xv-anos-lia-haro/');
        } else {
            await sendImage(userId, FIREBASE_URLS.imagenBoda2, esEspanol
                ? '\ud83d\udc8c *Un amor que se viste de blanco y negro...*\n\nHugo & Nickole\n\ud83d\udc49 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/ \ud83d\udda4\ud83e\uddd1\u200d\ud83e\udd1d\u200d\ud83e\uddd1'
                : '\ud83d\udc8c *A love dressed in black and white...*\n\nHugo & Nickole\n\ud83d\udc49 https://invitarts.com/boda-hugo-nickole-una-celebracion-unica-muestras/');
        }
        await sleep(2000); if (userStates.get(userId)?.duenoAtendio) return;
        await sendImage(userId, FIREBASE_URLS.imagenCatalogo, esEspanol
            ? '\u00a1Con todo cari\u00f1o le enviamos nuestro cat\u00e1logo! \ud83c\udf89\n\n\u00c9chele un vistazo: https://invitartes.com/catalogo/\n\nPuede elegir un modelo o creamos un dise\u00f1o \u00fanico. \ud83d\udc9b'
            : 'We are happy to share our catalog! \ud83c\udf89\n\nTake a look: https://invitartes.com/catalogo/ \ud83d\udc9b');
        await enviarFlujoPaquetes(userId, esEspanol, tipoEvento, phone);
    } catch (err) { console.error('\u274c Error secuencia:', err.message); }
    finally { processingUsers.delete(userId); }
}
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();
    sock = makeWASocket({
        version, auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        browser: ['Invitartes Bot', 'Chrome', '1.0.0'],
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
        if (connection === 'open') { isConnected = true; qrCodeData = ''; console.log('\u2705 Bot conectado!'); }
    });
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const message of messages) {
            try {
                if (message.key.remoteJid?.endsWith('@g.us')) continue;
                const userId = message.key.remoteJid;
                const phone = userId ? userId.replace('@s.whatsapp.net', '') : '';
                if (message.key.fromMe) {
                    let e = userStates.get(userId);
                    if (!e) {
                        userStates.set(userId, {
                            paso: 'bienvenida', esEspanol: null, tipoEvento: null,
                            intentoMenu: 0, secuenciaCompleta: false,
                            respondioPostSecuencia: false, seguimiento1Enviado: false,
                            seguimiento2Enviado: false, seguimiento3Enviado: false,
                            seguimiento4Enviado: false, seguimiento7dEnviado: false,
                            duenoAtendio: true, conversacionLibre: false,
                            menuMapa: null, opcionesUsadas: [], intentoMenuB: 0
                        });
                    } else { e.duenoAtendio = true; }
                    console.log('\ud83d\udc64 Due\u00f1o atendi\u00f3: ' + userId);
                    continue;
                }
                const messageText = (message.message?.conversation || message.message?.extendedTextMessage?.text || '').trim();
                if (!messageText) continue;
                const msgNorm = normalizarNumero(messageText);
                console.log('\ud83d\udce9 ' + phone + ': "' + messageText + '"');
                if (processingUsers.has(userId)) {
                    const elapsed = Date.now() - processingUsers.get(userId);
                    if (elapsed < 5 * 60 * 1000) continue;
                    processingUsers.delete(userId);
                }
                let estado = userStates.get(userId);
                if (estado && !estado.duenoAtendio && !estado.conversacionLibre && esKeywordAsesor(messageText)) {
                    processingUsers.set(userId, Date.now());
                    await enviarMensajeAsesorSolicitado(userId, estado.esEspanol !== false);
                    continue;
                }
                if (!estado) {
                    processingUsers.set(userId, Date.now());
                    clienteContador++;
                    userStates.set(userId, {
                        paso: 'bienvenida', esEspanol: null, tipoEvento: null,
                        intentoMenu: 0, secuenciaCompleta: false,
                        respondioPostSecuencia: false, seguimiento1Enviado: false,
                        seguimiento2Enviado: false, seguimiento3Enviado: false,
                        seguimiento4Enviado: false, seguimiento7dEnviado: false,
                        duenoAtendio: false, conversacionLibre: false,
                        menuMapa: null, opcionesUsadas: [], intentoMenuB: 0
                    });
                    estado = userStates.get(userId);
                    console.log('\ud83c\udd95 Cliente #' + clienteContador + ' | ' + phone);
                    if (esKeywordGuia(messageText)) {
                        estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, true).catch(console.error);
                        continue;
                    }
                    if (esAngloparlante(phone)) {
                        estado.paso = 'pregunta_idioma';
                        enviarPreguntaIdioma(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else {
                        enviarBienvenida(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }
                if (estado.duenoAtendio) continue;
                if (estado.paso === 'bienvenida' && esKeywordGuia(messageText)) {
                    processingUsers.set(userId, Date.now());
                    estado.paso = 'guia_segmento';
                    enviarGuiaGratuita(userId, estado.esEspanol !== false).catch(console.error);
                    processingUsers.delete(userId); continue;
                }
                if (estado.paso === 'pregunta_idioma') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true; estado.paso = 'bienvenida';
                        enviarBienvenida(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = false; estado.paso = 'bienvenida_en';
                        enviarBienvenidaIngles(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarPreguntaIdioma(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }
                if (estado.paso === 'bienvenida_en') {
                    const opciones = { '1': 'boda', '2': 'xv', '3': 'otro' };
                    if (opciones[msgNorm]) {
                        processingUsers.set(userId, Date.now()); estado.paso = 'en_secuencia';
                        const t = opciones[msgNorm];
                        if (t === 'xv') enviarSecuenciaXV(userId, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        else enviarSecuencia(userId, false, t, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '4') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, false).catch(console.error); processingUsers.delete(userId);
                    } else {
                        processingUsers.set(userId, Date.now());
                        enviarBienvenidaIngles(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }
                if (estado.paso === 'guia_segmento') {
                    const mapa = { '1': 'boda', '2': 'xv', '3': 'otro' };
                    const tipo = mapa[msgNorm];
                    if (tipo) {
                        processingUsers.set(userId, Date.now());
                        estado.tipoEvento = tipo; estado.paso = 'guia_puente';
                        enviarPuenteEmocional(userId, tipo, estado.esEspanol !== false).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }
                if (estado.paso === 'guia_permiso') {
                    if (msgNorm === '1') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'en_secuencia';
                        enviarFlujoPaquetes(userId, estado.esEspanol !== false, estado.tipoEvento || 'boda', phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '2') {
                        await sendText(userId, '\u00a1Perfecto! Disfruta la gu\u00eda y si m\u00e1s adelante necesitas algo, aqu\u00ed estamos. \ud83d\udc9b');
                        estado.conversacionLibre = true; estado.paso = 'libre';
                    }
                    continue;
                }
                if (estado.paso === 'flujoB_menu') {
                    if (estado.menuMapa && estado.menuMapa.find(o => o.num === msgNorm)) {
                        estado.intentoMenuB = 0;
                        await manejarOpcionMenuB(userId, msgNorm, estado.esEspanol !== false, phone);
                    } else {
                        estado.intentoMenuB = (estado.intentoMenuB || 0) + 1;
                        if (estado.intentoMenuB === 1) {
                            processingUsers.set(userId, Date.now());
                            const menu = getMenuPostPaquetes(estado.opcionesUsadas || [], estado.esEspanol !== false);
                            await sendText(userId, menu.texto); processingUsers.delete(userId);
                        } else {
                            processingUsers.set(userId, Date.now());
                            await enviarMensajeAsesorFinal(userId);
                        }
                    }
                    continue;
                }
                if (estado.paso === 'bienvenida') {
                    const opciones = { '1': 'xv', '2': 'boda', '3': 'otro' };
                    if (opciones[msgNorm]) {
                        processingUsers.set(userId, Date.now());
                        estado.esEspanol = true; estado.paso = 'en_secuencia';
                        const t = opciones[msgNorm];
                        if (t === 'xv') enviarSecuenciaXV(userId, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        else enviarSecuencia(userId, true, t, phone).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    } else if (msgNorm === '4') {
                        processingUsers.set(userId, Date.now()); estado.paso = 'guia_segmento';
                        enviarGuiaGratuita(userId, true).catch(console.error); processingUsers.delete(userId);
                    } else {
                        estado.intentoMenu = (estado.intentoMenu || 0) + 1;
                        processingUsers.set(userId, Date.now());
                        if (estado.intentoMenu === 1) enviarMenuRepetido(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                        else enviarMensajeAsesorFinal(userId).catch(err => { console.error(err.message); processingUsers.delete(userId); });
                    }
                    continue;
                }
                if (estado.secuenciaCompleta && estado.paso !== 'flujoB_menu') { estado.respondioPostSecuencia = true; continue; }
                if (estado.conversacionLibre || estado.paso === 'libre') continue;
            } catch (err) { console.error('\u274c Error handler:', err.message); }
        }
    });
}
app.get('/', async (req, res) => {
    if (isConnected) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Bot</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}h1{color:#667eea}.s{background:#d4edda;color:#155724;padding:1rem;border-radius:10px}</style></head><body><div class="c"><h1>\u2705 Bot Conectado</h1><div class="s"><h2>\ud83c\udf89 Funcionando correctamente</h2></div></div></body></html>');
    } else if (qrCodeData) {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"><title>Conectar</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:2rem;border-radius:20px;text-align:center;max-width:500px}h1{color:#667eea}img{max-width:280px}</style></head><body><div class="c"><h1>\ud83d\udcf1 Conectar WhatsApp</h1><img src="' + qrCodeData + '" alt="QR"><p>Se actualiza cada 5 segundos</p></div></body></html>');
    } else {
        res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="3"><title>Iniciando</title><style>body{font-family:system-ui;background:linear-gradient(135deg,#667eea,#764ba2);min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0}.c{background:white;padding:3rem;border-radius:20px;text-align:center}.l{border:6px solid #f3f3f3;border-top:6px solid #667eea;border-radius:50%;width:50px;height:50px;animation:spin 1s linear infinite;margin:0 auto 20px}@keyframes spin{100%{transform:rotate(360deg)}}h1{color:#667eea}</style></head><body><div class="c"><div class="l"></div><h1>\u23f3 Iniciando...</h1></div></body></html>');
    }
});
app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: isConnected, clienteContador });
});
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n\ud83e\udd16 INVITARTES BOT v8.0 (Solo Flujo A + Banco Pichincha + Seguimientos mejorados)');
    console.log('\ud83c\udf10 Puerto: ' + PORT);
    startBot();
});
process.on('SIGTERM', () => process.exit(0));
