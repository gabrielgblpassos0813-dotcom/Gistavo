const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
const NOTIFICATION_NUMBER = '5511970731504@s.whatsapp.net';
const AUTH_FOLDER = path.join(__dirname, 'auth_info');
const PORT = 8002;

let sock = null;
let qrCodeData = null;
let isConnected = false;
let connectionStatus = 'disconnected';

// Create HTTP server to expose QR code and status
const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url === '/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: connectionStatus,
            connected: isConnected,
            qrCode: qrCodeData
        }));
    } else if (req.url === '/qr') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            qrCode: qrCodeData,
            connected: isConnected
        }));
    } else if (req.url.startsWith('/send-notification') && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                const result = await sendPixNotification(data);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else if (req.url === '/disconnect' && req.method === 'POST') {
        if (sock) {
            sock.logout();
            isConnected = false;
            connectionStatus = 'disconnected';
            qrCodeData = null;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    } else {
        res.writeHead(404);
        res.end('Not found');
    }
});

// Send PIX notification to WhatsApp WITH IMAGE
async function sendPixNotification(data) {
    if (!isConnected || !sock) {
        return { success: false, error: 'WhatsApp não conectado' };
    }
    
    const message = `📱 *Novo Pedido PIX Confirmado!*

👤 *Nome do Pagador:* ${data.payerName || data.customerName || 'Não informado'}
💰 *Valor:* R$ ${data.amount?.toFixed(2) || '0.00'}
📍 *Local:* ${data.store === 'gym-londres' ? 'GYM Londres' : 'Runner'}
🕐 *Horário:* ${data.time || new Date().toLocaleTimeString('pt-BR')}
📋 *Pedido:* ${data.orderNumber || 'N/A'}
${data.autoApproved ? '✅ *Auto-aprovado pela IA*' : ''}

${data.items ? `*Itens:*\n${data.items.map(i => `• ${i.name} x${i.quantity}`).join('\n')}` : ''}`;

    try {
        // If we have a proof image, send it with caption
        if (data.proofImage) {
            // Convert base64 to buffer
            const imageBuffer = Buffer.from(data.proofImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            
            await sock.sendMessage(NOTIFICATION_NUMBER, {
                image: imageBuffer,
                caption: message
            });
            console.log('Notification with image sent to:', NOTIFICATION_NUMBER);
        } else {
            // Send text only
            await sock.sendMessage(NOTIFICATION_NUMBER, { text: message });
            console.log('Text notification sent to:', NOTIFICATION_NUMBER);
        }
        
        return { success: true, message: 'Notificação enviada!' };
    } catch (error) {
        console.error('Error sending notification:', error);
        return { success: false, error: error.message };
    }
}

// Start WhatsApp connection
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);
    const { version } = await fetchLatestBaileysVersion();
    
    const logger = pino({ level: 'silent' });
    
    sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: ['GANOH Bot', 'Chrome', '120.0.0'],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000,
        emitOwnEvents: true,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        markOnlineOnConnect: true
    });
    
    sock.ev.on('creds.update', saveCreds);
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
            connectionStatus = 'waiting_qr';
            console.log('New QR code generated');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            isConnected = false;
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log('Connection closed. Reason:', reason);
            
            if (reason !== DisconnectReason.loggedOut) {
                connectionStatus = 'reconnecting';
                console.log('Reconnecting...');
                setTimeout(startBot, 3000);
            } else {
                connectionStatus = 'logged_out';
                qrCodeData = null;
                // Clear auth folder
                if (fs.existsSync(AUTH_FOLDER)) {
                    fs.rmSync(AUTH_FOLDER, { recursive: true });
                }
                console.log('Logged out. Restart bot to reconnect.');
            }
        } else if (connection === 'open') {
            isConnected = true;
            connectionStatus = 'connected';
            qrCodeData = null;
            console.log('WhatsApp connected!');
        }
    });
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        // Handle incoming messages if needed
        for (const msg of messages) {
            if (msg.key.fromMe) continue;
            console.log('Received message from:', msg.key.remoteJid);
        }
    });
}

// Start server and bot
server.listen(PORT, () => {
    console.log(`WhatsApp Bot server running on port ${PORT}`);
    startBot();
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down...');
    if (sock) sock.end();
    server.close();
    process.exit(0);
});
