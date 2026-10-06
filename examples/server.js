const express = require('express');
const path = require('path');
const { AdProofCaptchaServer } = require('../packages/server/index.js');

const app = express();
app.use(express.json());

app.use('/client', express.static(path.join(__dirname, '../packages/client')));
app.use(express.static(path.join(__dirname, 'public')));

const captchaEngine = new AdProofCaptchaServer({
    secretKey: process.env.CAPTCHA_SECRET || 'SUPER_SECRET_ENVIRONMENT_KEY',
    powDifficulty: 5,
    sessionExpiryMs: 120000
});

app.post('/api/captcha/sync', (req, res) => {
    try {
        const challenge = captchaEngine.generateChallenge();
        res.json(challenge);
    } catch (err) {
        res.status(500).json({ error: "Server generation failed" });
    }
});

app.post('/api/captcha/commit', (req, res) => {
    try {
        const { ticket, clicks, pow, nonce, canvasHash } = req.body;
        
        captchaEngine.verifyCommit(ticket, clicks, pow, nonce, canvasHash);
        
        res.json({
            status: "success",
            protectedPayload: "오늘의 명언: '창의성이란 단지 사물들을 서로 연결하는 것뿐입니다.' - 스티브 잡스"
        });
    } catch (err) {
        res.status(403).json({ error: err.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`AdProofCAPTCHA Example server running on http://localhost:${PORT}`);
});
