const crypto = require('crypto');

class AdProofCaptchaServer {
    constructor(options = {}) {
        this.secretKey = options.secretKey || crypto.randomBytes(32).toString('hex');
        this.powDifficulty = options.powDifficulty || 5;
        this.sessionExpiryMs = options.sessionExpiryMs || 120000;
        this.activeTicketsCache = new Map();

        this.COLORS = [
            [255, 60, 60],
            [60, 255, 60],
            [60, 160, 255],
            [255, 230, 60],
            [60, 255, 240],
            [255, 140, 0]
        ];

        this.SHAPES = [
            (i, j) => true,
            (i, j) => i < 2 || i > 7 || j < 2 || j > 7,
            (i, j) => (i > 3 && i < 6) || (j > 3 && j < 6),
            (i, j) => i === j || i + j === 9 || i === j+1 || i+1 === j || i+j === 8 || i+j === 10,
            (i, j) => Math.abs(i - 4.5) + Math.abs(j - 4.5) < 5,
            (i, j) => i >= Math.abs(j - 4.5) * 1.5,
            (i, j) => i <= 9 - Math.abs(j - 4.5) * 1.5,
            (i, j) => (j < 3) || (i > 6),
            (i, j) => (j > 1 && j < 4) || (j > 5 && j < 8) || (i > 3 && i < 6),
            (i, j) => (j < 3 && i < 8) || (j > 6 && i < 8) || (i > 6)
        ];
    }

    cleanUpTickets() {
        const now = Date.now();
        for (const [ticket, session] of this.activeTicketsCache.entries()) {
            if (now > session.expiry) this.activeTicketsCache.delete(ticket);
        }
    }

    setPixel(buf, x, y, color) {
        if (x >= 0 && x < 300 && y >= 0 && y < 250) {
            const offset = 54 + (y * 300 + x) * 3;
            buf[offset] = color[2];
            buf[offset + 1] = color[1];
            buf[offset + 2] = color[0];
        }
    }

    drawLine(buf, x0, y0, x1, y1, color) {
        let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
        let dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
        let err = (dx > dy ? dx : -dy) / 2;
        while (true) {
            for (let ox = -2; ox <= 2; ox++) {
                for (let oy = -2; oy <= 2; oy++) {
                    this.setPixel(buf, x0 + ox, y0 + oy, color);
                }
            }
            if (x0 === x1 && y0 === y1) break;
            let e2 = err;
            if (e2 > -dx) { err -= dy; x0 += sx; }
            if (e2 < dy) { err += dx; y0 += sy; }
        }
    }

    drawSmallSolid(buf, cx, cy, shapeIdx, colorIdx) {
        const c = this.COLORS[colorIdx];
        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                if (this.SHAPES[shapeIdx](i, j)) {
                    this.setPixel(buf, cx + j - 5, cy + i - 5, c);
                }
            }
        }
    }

    drawLargeDotted(buf, cx, cy, shapeIdx, colorIdx) {
        const c = this.COLORS[colorIdx];
        const angle = (Math.random() - 0.5) * 0.45;
        const shearX = (Math.random() - 0.5) * 0.3;
        const shearY = (Math.random() - 0.5) * 0.3;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);

        for (let i = 0; i < 10; i++) {
            for (let j = 0; j < 10; j++) {
                if (this.SHAPES[shapeIdx](i, j)) {
                    let ox = (j - 4.5) * 2;
                    let oy = (i - 4.5) * 2;
                    let rx = (ox * cosA - oy * sinA) + (oy * shearX);
                    let ry = (ox * sinA + oy * cosA) + (ox * shearY);
                    let px = Math.round(cx + rx);
                    let py = Math.round(cy + ry);
                    
                    if (Math.random() > 0.3) this.setPixel(buf, px, py, c);
                    if (Math.random() > 0.3) this.setPixel(buf, px + 1, py, c);
                    if (Math.random() > 0.3) this.setPixel(buf, px, py + 1, c);
                    if (Math.random() > 0.3) this.setPixel(buf, px + 1, py + 1, c);
                }
            }
        }
    }

    generateHeterogeneousBMP(targets, gridItems) {
        const width = 300, height = 250;
        const fileSize = 54 + (width * height * 3);
        const buffer = Buffer.alloc(fileSize, 0); 

        buffer.write('BM', 0);
        buffer.writeUInt32LE(fileSize, 2);
        buffer.writeUInt32LE(0, 6);
        buffer.writeUInt32LE(54, 10); 
        buffer.writeUInt32LE(40, 14);
        buffer.writeInt32LE(width, 18);
        buffer.writeInt32LE(-height, 22);
        buffer.writeUInt16LE(1, 26); 
        buffer.writeUInt16LE(24, 28); 
        buffer.writeUInt32LE(0, 30); 
        buffer.writeUInt32LE(width * height * 3, 34); 
        buffer.writeInt32LE(2835, 38);
        buffer.writeInt32LE(2835, 42); 
        buffer.writeUInt32LE(0, 46);
        buffer.writeUInt32LE(0, 50);

        for (let y = 0; y < 46; y++) {
            for (let x = 0; x < 300; x++) {
                this.setPixel(buffer, x, y, [24, 24, 30]);
            }
        }

        for (let y = 46; y < height; y++) {
            for (let x = 0; x < width; x++) {
                this.setPixel(buffer, x, y, [255, 0, 255]);
            }
        }

        for (let i = 0; i < 15; i++) {
            let rx1 = Math.floor(Math.random() * 300), ry1 = Math.floor(Math.random() * 204) + 46;
            let rx2 = Math.floor(Math.random() * 300), ry2 = Math.floor(Math.random() * 204) + 46;
            let cIdx = Math.floor(Math.random() * 6);
            this.drawLine(buffer, rx1, ry1, rx2, ry2, this.COLORS[cIdx]);
        }

        for (let item of gridItems) {
            this.drawLargeDotted(buffer, item.x, item.y, item.shape, item.color);
        }

        for (let i = 0; i < 10; i++) {
            let rx1 = Math.floor(Math.random() * 300), ry1 = Math.floor(Math.random() * 204) + 46;
            let rx2 = Math.floor(Math.random() * 300), ry2 = Math.floor(Math.random() * 204) + 46;
            let cIdx = Math.floor(Math.random() * 6);
            this.drawLine(buffer, rx1, ry1, rx2, ry2, this.COLORS[cIdx]);
        }

        this.drawLine(buffer, 0, 46, 299, 46, [100, 100, 110]);

        this.drawSmallSolid(buffer, 70, 23, targets[0].shape, targets[0].color);
        this.drawSmallSolid(buffer, 150, 23, targets[1].shape, targets[1].color);
        this.drawSmallSolid(buffer, 230, 23, targets[2].shape, targets[2].color);

        return `data:image/bmp;base64,${buffer.toString('base64')}`;
    }

    generateChallenge() {
        this.cleanUpTickets();

        let allCombos = [];
        for (let c = 0; c < 6; c++) {
            for (let s = 0; s < 10; s++) {
                allCombos.push({ color: c, shape: s });
            }
        }
        
        allCombos.sort(() => Math.random() - 0.5);
        let selected25 = allCombos.slice(0, 25);

        let gridItems = [];
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 5; col++) {
                let item = selected25[row * 5 + col];
                let cx = 40 + col * 55;
                let cy = 75 + row * 40;
                gridItems.push({ x: cx, y: cy, shape: item.shape, color: item.color });
            }
        }

        const targets = [...gridItems].sort(() => Math.random() - 0.5).slice(0, 3);
        const ticketId = crypto.randomBytes(16).toString('hex');

        this.activeTicketsCache.set(ticketId, {
            t: targets.map(item => ({ x: item.x, y: item.y })),
            time: Date.now(),
            expiry: Date.now() + this.sessionExpiryMs
        });

        const challengeImage = this.generateHeterogeneousBMP(targets, gridItems);

        return {
            ticket: ticketId,
            challengeImage: challengeImage,
            difficulty: this.powDifficulty
        };
    }

    verifyCommit(ticket, clicks, pow, nonce, canvasHash) {
        this.cleanUpTickets();

        if (!ticket || !Array.isArray(clicks) || clicks.length !== 3 || !pow || nonce === undefined) {
            throw new Error("MALFORMED_PAYLOAD");
        }

        const session = this.activeTicketsCache.get(ticket);
        if (!session) {
            throw new Error("TICKET_INVALID_OR_CONSUMED");
        }
        
        this.activeTicketsCache.delete(ticket); 

        if (Date.now() - session.time < 5000) {
            throw new Error("TIME_VIOLATION: Interaction too fast");
        }

        const coordsStr = clicks.map(c => c.x + ',' + c.y).join('|');
        const expectedMsg = coordsStr + canvasHash + nonce.toString();
        const calculatedPoW = crypto.createHash('sha256').update(expectedMsg).digest('hex');

        if (!calculatedPoW.startsWith('0'.repeat(this.powDifficulty)) || calculatedPoW !== pow) {
            throw new Error("POW_VIOLATION: Hash mismatch");
        }

        for (let i = 0; i < 3; i++) {
            const target = session.t[i];
            const dx = target.x - clicks[i].x;
            const dy = target.y - clicks[i].y;
            if (Math.sqrt(dx * dx + dy * dy) > 20) {
                throw new Error(`TARGET_MISS: Step ${i + 1} selection incorrect`);
            }
        }

        return true;
    }
}

module.exports = { AdProofCaptchaServer };
