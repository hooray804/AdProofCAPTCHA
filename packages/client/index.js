class AdProofCaptchaClient {
    constructor(config) {
        this.endpoint = config.endpoint;
        this.adBannerUrl = config.adBannerUrl;
        this.targetContainerId = config.targetContainerId;
        this.onVerified = config.onVerified || function() {};
        this.onError = config.onError || function() {};
        
        this.currentTicket = null;
        this.powDifficulty = 5;
        this.finalCanvasHash = null;
        this.isInteractable = false;
        this.collectedClicks = [];
        
        this._runSecurityChecks();
    }

    _triggerAlarm(reason) {
        document.documentElement.innerHTML = `
            <head><title>보안 중단</title></head>
            <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#4a0000; color:#fff; font-family:sans-serif; text-align:center; padding:20px; margin:0;">
                <h1 style="font-size:2.5rem; margin-bottom:10px; color:#ff4444;">SECURITY HALT</h1>
                <p style="font-size:1.2rem; margin-bottom:5px;">비정상적인 접근 또는 봇 스크립트가 차단되었습니다.</p>
                <p style="font-size:1rem; color:#ffaaaa; background:#220000; padding:12px; border-radius:5px; max-width:80%; word-break:break-all;">코드: ${reason}</p>
            </body>
        `;
        throw new Error("Halted: " + reason);
    }

    _runSecurityChecks() {
        try {
            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'display:none; position:absolute; width:0; height:0; border:0;';
            document.documentElement.appendChild(iframe);
            this._Window = iframe.contentWindow;

            if (this._Window.Function.prototype.toString.toString().indexOf('[native code]') === -1) {
                this._triggerAlarm("API_HOOKING_DETECTED");
            }
            this._Window.Object.freeze(this._Window.fetch);
            this._Window.Object.freeze(this._Window.crypto.subtle);

            this.safeFetch = this._Window.fetch;
            this.safeAttachShadow = this._Window.Element.prototype.attachShadow;
            this.safeMutationObserver = this._Window.MutationObserver;
            this.safeCrypto = this._Window.crypto.subtle;

            this.iframeNode = iframe;
        } catch (e) {
            this._triggerAlarm(`INIT_FAILED: ${e.name}`);
        }
    }

    mount() {
        const randStr = () => Math.random().toString(36).substring(2, 12);
        const TAG_APP = `sys-quote-${randStr()}`;
        
        this.mountPoint = document.getElementById(this.targetContainerId);
        if (!this.mountPoint) throw new Error("Target container not found");
        
        const shadow = this.safeAttachShadow.call(this.mountPoint, { mode: 'closed' });

        const styleEl = document.createElement('style');
        styleEl.textContent = `
            ${TAG_APP} { display: flex; flex-direction: column; align-items: center; justify-content: center; background: transparent; color: #fff; width: 100%; }
            button { padding: 14px 28px; font-size: 16px; font-weight: bold; cursor: pointer; background: #2563eb; color: #fff; border: none; border-radius: 6px; margin-bottom: 15px; transition: 0.2s; box-shadow: 0 4px 15px rgba(37,99,235,0.4); }
            button:hover { background: #1d4ed8; }
            button:disabled { background: #333; color: #777; cursor: not-allowed; }
            canvas { border: 2px solid #555; background: #000; margin-bottom: 15px; box-shadow: 0 0 25px rgba(0,0,0,0.8); display: none; touch-action: none; }
            canvas.active { cursor: crosshair; border-color: #facc15; }
            .info { font-family: monospace; font-size: 13.5px; color: #aaa; min-height: 45px; text-align: center; max-width: 480px; word-break: keep-all; margin-bottom: 10px; line-height: 1.5; }
            .click-count { font-size: 16px; color: #fff; margin-bottom: 10px; display: none; font-weight: bold; }
            .red { color: #f87171; font-weight: bold; }
            .green { color: #4ade80; font-weight: bold; }
            .yellow { color: #facc15; font-weight: bold; }
        `;
        shadow.appendChild(styleEl);

        const container = document.createElement(TAG_APP);
        const startBtn = document.createElement('button');
        startBtn.innerText = "보안 인증 시작하기";

        const canvas = document.createElement('canvas');
        canvas.width = 300; canvas.height = 250;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const clickIndicator = document.createElement('div');
        clickIndicator.className = 'click-count';
        clickIndicator.innerText = "선택된 도형: 0 / 3";

        const infoDiv = document.createElement('div');
        infoDiv.className = 'info';
        infoDiv.innerText = "로봇이 아님을 증명하려면 위 버튼을 누르세요.";

        container.appendChild(startBtn);
        container.appendChild(clickIndicator);
        container.appendChild(canvas);
        container.appendChild(infoDiv);
        shadow.appendChild(container);

        const workerCode = `
            self.onmessage = async function(e) {
                const { clicks, canvasHash, difficulty } = e.data;
                const prefix = '0'.repeat(difficulty);
                const coordsStr = clicks.map(c => c.x + ',' + c.y).join('|');
                let nonce = 0;
                
                while (true) {
                    const message = coordsStr + canvasHash + nonce.toString();
                    const msgBuffer = new TextEncoder().encode(message);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    
                    let powHex = '';
                    for (let i = 0; i < hashArray.length; i++) {
                        powHex += hashArray[i].toString(16).padStart(2, '0');
                        if (powHex.length >= difficulty && !powHex.startsWith(prefix)) break;
                    }
                    
                    if (powHex.length === 64 && powHex.startsWith(prefix)) {
                        self.postMessage({ pow: powHex, nonce: nonce });
                        break;
                    }
                    nonce++;
                }
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);

        startBtn.addEventListener('click', async () => {
            startBtn.disabled = true;
            infoDiv.className = 'info yellow';
            infoDiv.innerText = "안티-비전 퍼즐을 생성 중입니다...";

            try {
                const res = await this.safeFetch(`${this.endpoint}/sync?cb=${randStr()}`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}) 
                });
                if (!res.ok) throw new Error('HTTP_' + res.status);

                const data = await res.json();
                this.currentTicket = data.ticket;
                this.powDifficulty = data.difficulty;

                await this._renderCombinedAd(ctx, data.challengeImage);

                canvas.style.display = 'block';
                startBtn.style.display = 'none';
                infoDiv.innerText = "광고 로드 완료. 봇 방어 확인 중입니다...";

                setTimeout(() => {
                    this.isInteractable = true;
                    canvas.classList.add('active');
                    clickIndicator.style.display = 'block';
                    infoDiv.className = 'info green';
                    infoDiv.innerHTML = "상단 바에 표시된 3개의 도형과<br/><b>'모양과 색상이 일치하는 큰 점선 도형'</b>을<br/>하단 그리드에서 순서대로 클릭하세요.";
                }, 5000);

            } catch (err) {
                this._triggerAlarm(`NETWORK_BLOCKED (${err.message})`);
            }
        });

        const handleInteraction = async (clientX, clientY) => {
            if (!this.isInteractable) return;
            const rect = canvas.getBoundingClientRect();
            const clickX = Math.round(clientX - rect.left);
            const clickY = Math.round(clientY - rect.top);
            
            if (clickY < 46) return;

            this.collectedClicks.push({ x: clickX, y: clickY });
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.arc(clickX, clickY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 11px monospace';
            ctx.fillText(this.collectedClicks.length, clickX - 3.5, clickY + 3.5);

            clickIndicator.innerText = `선택된 도형: ${this.collectedClicks.length} / 3`;

            if (this.collectedClicks.length < 3) return;

            this.isInteractable = false;
            canvas.classList.remove('active');
            infoDiv.className = 'info yellow';
            infoDiv.innerText = `작업 증명 연산 중... 무결성 검증을 수행합니다.`;

            try {
                const worker = new Worker(workerUrl);
                const { pow, nonce } = await new Promise(res => {
                    worker.onmessage = ev => { worker.terminate(); res(ev.data); };
                    worker.postMessage({ clicks: this.collectedClicks, canvasHash: this.finalCanvasHash, difficulty: this.powDifficulty });
                });

                infoDiv.innerText = "서버로 데이터 전송 및 콘텐츠 해제 요청 중...";

                const res = await this.safeFetch(`${this.endpoint}/commit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ticket: this.currentTicket,
                        clicks: this.collectedClicks,
                        pow: pow,
                        nonce: nonce,
                        canvasHash: this.finalCanvasHash
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    infoDiv.className = 'info red';
                    infoDiv.innerText = `검증 실패: ${errorData.error}\n(도형 순서가 틀렸거나 세션이 만료되었습니다)`;
                    this.onError(new Error(errorData.error));
                    setTimeout(() => location.reload(), 3000);
                    return;
                }

                const resultData = await res.json();
                canvas.style.display = 'none';
                clickIndicator.style.display = 'none';
                infoDiv.style.display = 'none';
                this.onVerified(resultData);

            } catch (err) {
                this._triggerAlarm(`FETCH_TAMPERED (${err.message})`);
            }
        };

        canvas.addEventListener('click', (e) => {
            if (!e.isTrusted) { this._triggerAlarm("AUTOMATED_CLICK_DETECTED"); return; }
            handleInteraction(e.clientX, e.clientY);
        });

        canvas.addEventListener('touchstart', (e) => {
            if (!e.isTrusted) return;
            e.preventDefault();
            const touch = e.changedTouches[0];
            handleInteraction(touch.clientX, touch.clientY);
        }, { passive: false });

        const observer = new this.safeMutationObserver((mutations) => {
            mutations.forEach(m => {
                m.addedNodes.forEach(node => { if (node.tagName === 'SCRIPT') this._triggerAlarm("SCRIPT_INJECTION_DETECTED"); });
                m.removedNodes.forEach(node => { if (node === this.mountPoint || node === this.iframeNode) this._triggerAlarm("SECURITY_DOM_REMOVED"); });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    async _renderCombinedAd(ctx, base64Overlay) {
        return new Promise((resolve, reject) => {
            const banner = new Image();
            banner.crossOrigin = 'anonymous';
            banner.src = this.adBannerUrl;

            banner.onload = async () => {
                ctx.drawImage(banner, 0, 0, 300, 250);
                
                const imgData1 = ctx.getImageData(0, 0, 300, 250).data;
                const hBuf1 = await this.safeCrypto.digest('SHA-256', imgData1);
                this.finalCanvasHash = Array.from(new Uint8Array(hBuf1)).map(b => b.toString(16).padStart(2, '0')).join('');

                ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
                ctx.fillRect(0, 46, 300, 204); 

                const overlay = new Image();
                overlay.src = base64Overlay;
                overlay.onload = () => {
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = 300; tempCanvas.height = 250;
                    const tCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                    tCtx.drawImage(overlay, 0, 0);

                    const imgData = tCtx.getImageData(0, 0, 300, 250);
                    const data = imgData.data;
                    
                    for (let i = 0; i < data.length; i += 4) {
                        if (data[i] === 255 && data[i+1] === 0 && data[i+2] === 255) {
                            data[i+3] = 0;
                        }
                    }
                    tCtx.putImageData(imgData, 0, 0);
                    ctx.drawImage(tempCanvas, 0, 0);
                    resolve();
                };
                overlay.onerror = () => reject(new Error("OVERLAY_BLOCKED"));
            };
            banner.onerror = () => {
                this._triggerAlarm("BANNER_BLOCKED_BY_ADBLOCKER");
                reject(new Error("BANNER_FAILED"));
            };
        });
    }
}

window.AdProofCaptchaClient = AdProofCaptchaClient;
