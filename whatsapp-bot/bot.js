const { makeWASocket, useMultiFileAuthState, DisconnectReason, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Configuration
// Para enviar para grupo, use o formato: 'XXXXXXXXX@g.us'
// Para enviar para número, use: '5511XXXXXXXXX@s.whatsapp.net'
const NOTIFICATION_TARGET = process.env.WHATSAPP_TARGET || '5511970731504@s.whatsapp.net';
const AUTH_FOLDER = path.join(__dirname, 'auth_info');
const PORT = 8002;

let sock = null;
let qrCodeData = null;
let isConnected = false;
let connectionStatus = 'disconnected';
let availableGroups = [];

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
    } else if (req.url === '/groups') {
        // List available groups
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            success: true, 
            groups: availableGroups,
            currentTarget: NOTIFICATION_TARGET
        }));
    } else if (req.url.startsWith('/set-target') && req.method === 'POST') {
        // Set notification target (group or number)
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (data.target) {
                    process.env.WHATSAPP_TARGET = data.target;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, target: data.target }));
                } else {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Target not provided' }));
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
    } else if (req.url.startsWith('/join-group') && req.method === 'POST') {
        // Join a group via invite link
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                if (!data.inviteLink) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invite link not provided' }));
                    return;
                }
                
                if (!isConnected || !sock) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'WhatsApp not connected' }));
                    return;
                }
                
                // Extract invite code from link
                const inviteCode = data.inviteLink.split('chat.whatsapp.com/')[1]?.split('?')[0];
                if (!inviteCode) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'Invalid invite link' }));
                    return;
                }
                
                // Join the group
                const groupId = await sock.groupAcceptInvite(inviteCode);
                console.log('Joined group:', groupId);
                
                // Set as target
                process.env.WHATSAPP_TARGET = groupId;
                
                // Refresh groups list
                const groups = await sock.groupFetchAllParticipating();
                availableGroups = Object.values(groups).map(g => ({
                    id: g.id,
                    name: g.subject,
                    participants: g.participants?.length || 0
                }));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    groupId: groupId,
                    message: 'Entrou no grupo com sucesso!'
                }));
            } catch (error) {
                console.error('Error joining group:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });
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
    
    // Get current target (can be changed dynamically)
    const target = process.env.WHATSAPP_TARGET || NOTIFICATION_TARGET;
    
    const message = `📱 *Novo Pedido PIX Confirmado!*

👤 *Nome do Pagador:* ${data.payerName || data.customerName || 'Não informado'}
💰 *Valor:* R$ ${data.amount?.toFixed(2) || '0.00'}
📍 *Local:* ${data.store === 'gym-londres' ? 'GYM Londres' : 'Runner'}
📅 *Data:* ${data.date || new Date().toLocaleDateString('pt-BR')}
🕐 *Horário:* ${data.time || new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}
📋 *Pedido:* ${data.orderNumber || 'N/A'}
${data.autoApproved ? '✅ *Auto-aprovado pela IA*' : ''}

${data.items ? `*Itens:*\n${data.items.map(i => `• ${i.name} x${i.quantity}`).join('\n')}` : ''}`;

    try {
        // If we have a proof image, send it with caption
        if (data.proofImage) {
            // Convert base64 to buffer
            const imageBuffer = Buffer.from(data.proofImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
            
            await sock.sendMessage(target, {
                image: imageBuffer,
                caption: message
            });
            console.log('Notification with image sent to:', target);
        } else {
            // Send text only
            await sock.sendMessage(target, { text: message });
            console.log('Text notification sent to:', target);
        }
        
        return { success: true, message: 'Notificação enviada!', target: target };
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
            
            // Fetch available groups after connection
            try {
                const groups = await sock.groupFetchAllParticipating();
                availableGroups = Object.values(groups).map(g => ({
                    id: g.id,
                    name: g.subject,
                    participants: g.participants?.length || 0
                }));
                console.log('Available groups:', availableGroups.map(g => `${g.name} (${g.id})`));
            } catch (e) {
                console.error('Error fetching groups:', e);
            }
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
