/**
 * Módulo de Proyección en Vivo y Capturas de Pantalla (SS)
 */
window.NaSpireScreenshot = {
    currentImage: null,
    history: [],
    liveActive: false,
    liveTimer: null,
    capturing: false,
    frameTimes: [],

    init() {
        document.getElementById("btn-capture-ss").addEventListener("click", () => this.capture(true));
        document.getElementById("btn-save-ss").addEventListener("click", () => this.saveCurrent());
        document.getElementById("btn-copy-ss").addEventListener("click", () => this.copyCurrent());
        document.getElementById("btn-clear-ss-history").addEventListener("click", () => {
            this.history = [];
            this.renderHistory();
        });
        document.getElementById("ss-zoom").addEventListener("change", (e) => {
            document.getElementById("ss-img").style.width = `${e.target.value}px`;
        });
        document.getElementById("btn-projector-toggle").addEventListener("click", () => {
            if (this.liveActive) {
                this.stopLive();
            } else {
                this.startLive();
            }
        });
        document.getElementById("btn-fullscreen-ss").addEventListener("click", () => {
            const stage = document.getElementById("screen-stage");
            if (!document.fullscreenElement) {
                stage.requestFullscreen?.().catch(() => {});
                if (!this.liveActive && window.NaSpireApp.connected) {
                    this.startLive();
                }
            } else {
                document.exitFullscreen?.();
            }
        });
    },

    startLive() {
        if (!window.NaSpireApp.connected) {
            NaSpireUI.toast("Conecta la calculadora para proyectar en vivo", "error");
            return;
        }
        this.liveActive = true;
        this.frameTimes = [];
        this.updateProjectorUI();
        this._liveLoop();
    },

    stopLive() {
        this.liveActive = false;
        if (this.liveTimer) {
            clearTimeout(this.liveTimer);
            this.liveTimer = null;
        }
        this.updateProjectorUI();
    },

    updateProjectorUI() {
        const btn = document.getElementById("btn-projector-toggle");
        const fpsBadge = document.getElementById("ss-fps-badge");
        if (!btn) return;
        if (this.liveActive) {
            btn.innerHTML = `${NaSpireUI.icon("tv_live", 15)} Detener Proyección`;
            btn.classList.remove("btn-primary");
            btn.classList.add("btn-danger");
            if (fpsBadge) fpsBadge.style.display = "inline-block";
        } else {
            btn.innerHTML = `${NaSpireUI.icon("tv_live", 15)} Proyectar en Vivo`;
            btn.classList.remove("btn-danger");
            btn.classList.add("btn-primary");
            if (fpsBadge) fpsBadge.style.display = "none";
        }
    },

    async _liveLoop() {
        if (!this.liveActive || !window.NaSpireApp.connected) {
            this.stopLive();
            return;
        }
        const ok = await this.capture(false);
        if (!ok) {
            this.stopLive();
            return;
        }
        const now = performance.now();
        this.frameTimes.push(now);
        this.frameTimes = this.frameTimes.filter((t) => now - t <= 3000);
        if (this.frameTimes.length >= 2) {
            const span = (now - this.frameTimes[0]) / 1000;
            const fps = (this.frameTimes.length - 1) / Math.max(span, 0.1);
            const badge = document.getElementById("ss-fps-badge");
            if (badge) badge.textContent = `● EN VIVO • ${fps.toFixed(1)} FPS`;
        }

        const delay = Number(document.getElementById("ss-live-speed")?.value || 250);
        if (this.liveActive) {
            this.liveTimer = setTimeout(() => this._liveLoop(), delay);
        }
    },

    async capture(addToHistory = true) {
        if (!window.NaSpireApp.connected) {
            NaSpireUI.toast("Conecta la calculadora para sacar capturas", "error");
            return false;
        }
        if (this.capturing) return true;
        this.capturing = true;
        try {
            const res = await NaSpireAPI.screenshot();
            this.showImage(res.image, res.width, res.height);
            if (addToHistory) {
                const now = new Date().toLocaleTimeString();
                this.history.unshift({ image: res.image, width: res.width, height: res.height, time: now });
                if (this.history.length > 20) this.history.pop();
                this.renderHistory();
                NaSpireUI.toast("Captura realizada", "success");
            }
            return true;
        } catch (err) {
            NaSpireUI.toast(`Error en captura: ${err.message}`, "error");
            return false;
        } finally {
            this.capturing = false;
        }
    },

    showImage(dataUrl, w, h) {
        this.currentImage = dataUrl;
        const img = document.getElementById("ss-img");
        const ph = document.getElementById("ss-placeholder");
        img.src = dataUrl;
        img.style.display = "block";
        ph.style.display = "none";
        document.getElementById("btn-save-ss").disabled = false;
        document.getElementById("btn-copy-ss").disabled = false;
        if (w && h) {
            const model = window.NaSpireApp.deviceInfo?.device_name || "TI-Nspire";
            document.getElementById("ss-bezel-label").textContent = `${model.toUpperCase()} • ${w}×${h}`;
        }
    },

    saveCurrent() {
        if (!this.currentImage) return;
        const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        const a = document.createElement("a");
        a.href = this.currentImage;
        a.download = `NaSpire_SS_${ts}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        NaSpireUI.toast("PNG guardado", "success");
    },

    async copyCurrent() {
        if (!this.currentImage) return;
        try {
            const resp = await fetch(this.currentImage);
            const blob = await resp.blob();
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            NaSpireUI.toast("Captura copiada al portapapeles", "success");
        } catch {
            NaSpireUI.toast("No se pudo copiar al portapapeles en este entorno (usa PNG)", "error");
        }
    },

    renderHistory() {
        const list = document.getElementById("ss-history-list");
        if (!this.history.length) {
            list.innerHTML = `<div style="color:var(--text-muted);font-size:12px;text-align:center;padding:24px 8px;">Las capturas que saques aparecerán aquí.</div>`;
            return;
        }
        list.innerHTML = this.history
            .map(
                (item, idx) => `
                <div class="ss-thumb" data-idx="${idx}">
                    <img src="${item.image}" alt="SS ${item.time}" />
                    <div class="ss-thumb-meta">
                        <span>${item.time}</span>
                        <span>${item.width}×${item.height}</span>
                    </div>
                </div>`
            )
            .join("");
        list.querySelectorAll(".ss-thumb").forEach((el) => {
            el.addEventListener("click", () => {
                const it = this.history[Number(el.dataset.idx)];
                if (it) this.showImage(it.image, it.width, it.height);
            });
        });
    },
};
