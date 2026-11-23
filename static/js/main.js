/**
 * Orquestador principal de NaSpire Studio
 */
window.NaSpireApp = {
    connected: false,
    deviceInfo: null,

    async init() {
        NaSpireUI.setSplash(25, "Inicializando módulos de NaSpire...");

        // Navegación sidebar
        document.querySelectorAll(".nav-item").forEach((btn) => {
            btn.addEventListener("click", () => this.switchView(btn.dataset.view));
        });

        // Links externos (GitHub / Web de NachoFari)
        document.querySelectorAll("[data-external]").forEach((el) => {
            el.addEventListener("click", (e) => {
                e.preventDefault();
                NaSpireAPI.openExternal(el.dataset.external).catch(() => {
                    window.open(el.dataset.external, "_blank");
                });
            });
        });

        document.getElementById("btn-connect").addEventListener("click", () => this.connect());
        document.getElementById("btn-disconnect").addEventListener("click", () => this.disconnect());
        document.getElementById("btn-refresh-info").addEventListener("click", () => this.refreshInfo());
        document.getElementById("btn-check-updates")?.addEventListener("click", () => this.checkUpdates(true));
        document.getElementById("btn-update-pill")?.addEventListener("click", () => this.triggerUpdate());

        NaSpireExplorer.init();
        NaSpireScreenshot.init();
        NaSpireCreator.init();
        NaSpireEditor.init();
        NaSpireProfiles.init();
        NaSpireCatalog.init();

        try {
            NaSpireUI.setSplash(55, "Verificando servidor y herramientas...");
            const health = await NaSpireAPI.health();
            const lunaBadge = document.getElementById("luna-status-badge");
            if (health.luna?.luna_available) {
                lunaBadge.textContent = "Luna + XML Nativo listos";
                lunaBadge.style.color = "var(--success)";
            } else {
                lunaBadge.textContent = "Falta tools/luna.exe";
                lunaBadge.style.color = "var(--warning)";
            }

            const scan = await NaSpireAPI.scanDevices();
            this.renderSupportedModels(scan.supported || []);

            if (scan.devices && scan.devices.length > 0) {
                NaSpireUI.setSplash(80, `Calculadora detectada (${scan.devices[0].family}). Conectando...`);
                await this.connect(true);
            } else {
                NaSpireUI.setSplash(90, "Listo. Conecta una TI-Nspire por USB.");
            }
        } catch (err) {
            NaSpireUI.setSplash(100, "Iniciado en modo sin conexión.");
        }

        NaSpireUI.setSplash(100, "¡NaSpire Studio listo!");
        setTimeout(() => NaSpireUI.hideSplash(), 420);

        // Verificar actualizaciones de GitHub en segundo plano sin bloquear el inicio
        setTimeout(() => this.checkUpdates(false), 1800);
    },

    latestUpdateInfo: null,

    async checkUpdates(manual = false) {
        const statusEl = document.getElementById("update-status-text");
        if (manual && statusEl) statusEl.textContent = "Buscando actualizaciones en GitHub...";
        try {
            const res = await NaSpireAPI.checkUpdates();
            const verEl = document.getElementById("app-version-label");
            if (verEl && res.current_version) verEl.textContent = `v${res.current_version}`;
            if (res.update_available) {
                this.latestUpdateInfo = res;
                const pill = document.getElementById("btn-update-pill");
                const pillTxt = document.getElementById("update-pill-text");
                if (pill && pillTxt) {
                    pillTxt.textContent = `Actualizar a v${res.latest_version}`;
                    pill.style.display = "inline-flex";
                }
                if (statusEl) {
                    statusEl.style.color = "var(--success)";
                    statusEl.textContent = `Nueva versión disponible: v${res.latest_version} (haz clic arriba para actualizar).`;
                }
                NaSpireUI.toast(`Nueva versión NaSpire v${res.latest_version} disponible en GitHub`, "success");
            } else {
                if (statusEl) {
                    statusEl.style.color = "var(--text-muted)";
                    statusEl.textContent = res.message || `Estás al día (v${res.current_version}).`;
                }
                if (manual) NaSpireUI.toast(res.message || `NaSpire está actualizado (v${res.current_version})`, "success");
            }
        } catch (err) {
            if (manual) NaSpireUI.toast(`No se pudo verificar actualizaciones: ${err.message}`, "error");
        }
    },

    async triggerUpdate() {
        const info = this.latestUpdateInfo;
        if (!info) return this.checkUpdates(true);
        if (info.installer_url) {
            if (!confirm(`Se descargará e instalará NaSpire v${info.latest_version} automáticamente y la app se reiniciará. ¿Continuar?`)) {
                return;
            }
            try {
                NaSpireUI.toast(`Descargando NaSpire v${info.latest_version}...`);
                await NaSpireAPI.installUpdate(info.installer_url, info.installer_name);
                NaSpireUI.toast("Instalador iniciado. Actualizando NaSpire...", "success");
            } catch (err) {
                NaSpireUI.toast(`Error al actualizar: ${err.message}`, "error");
            }
        } else if (info.release_url) {
            NaSpireAPI.openExternal(info.release_url).catch(() => window.open(info.release_url, "_blank"));
        }
    },

    switchView(view) {
        document.querySelectorAll(".nav-item").forEach((b) => {
            b.classList.toggle("active", b.dataset.view === view);
        });
        document.querySelectorAll(".view-panel").forEach((p) => {
            p.classList.toggle("active", p.id === `view-${view}`);
        });
        if (view === "creator" && this.connected) {
            NaSpireCreator.refreshFolders(false);
        }
        if (view === "profiles") {
            NaSpireProfiles.loadSlots();
        }
        if (view !== "screenshot" && NaSpireScreenshot.liveActive) {
            NaSpireScreenshot.stopLive();
        }
    },

    async connect(silent = false) {
        const dot = document.getElementById("status-dot");
        dot.className = "status-dot busy";
        document.getElementById("device-title").textContent = "Conectando...";
        try {
            const res = await NaSpireAPI.connect();
            this.connected = true;
            this.deviceInfo = res.info;
            this.updateDeviceUI();
            await NaSpireExplorer.load("/");
            NaSpireCreator.refreshFolders(false);
            if (!silent) NaSpireUI.toast(`Conectada: ${res.info.device_name}`, "success");
        } catch (err) {
            this.connected = false;
            this.deviceInfo = null;
            this.updateDeviceUI();
            if (!silent) NaSpireUI.toast(err.message, "error");
        }
    },

    async disconnect() {
        NaSpireScreenshot.stopLive();
        await NaSpireAPI.disconnect().catch(() => {});
        this.connected = false;
        this.deviceInfo = null;
        this.updateDeviceUI();
        NaSpireExplorer.renderDisconnected();
        NaSpireUI.toast("Calculadora desconectada");
    },

    async refreshInfo() {
        if (!this.connected) return;
        try {
            const res = await NaSpireAPI.deviceInfo();
            if (res.connected && res.info) {
                this.deviceInfo = res.info;
                this.updateDeviceUI();
            }
        } catch (err) {
            NaSpireUI.toast(err.message, "error");
        }
    },

    updateDeviceUI() {
        const dot = document.getElementById("status-dot");
        const title = document.getElementById("device-title");
        const osChip = document.getElementById("device-os-chip");
        const battChip = document.getElementById("device-batt-chip");
        const btnConn = document.getElementById("btn-connect");
        const btnDisc = document.getElementById("btn-disconnect");
        const infoKv = document.getElementById("device-info-kv");

        if (!this.connected || !this.deviceInfo) {
            dot.className = "status-dot";
            title.textContent = "Desconectada";
            osChip.style.display = "none";
            battChip.style.display = "none";
            btnConn.style.display = "inline-flex";
            btnDisc.style.display = "none";
            document.getElementById("storage-text").textContent = "-- / --";
            document.getElementById("storage-bar").style.width = "0%";
            infoKv.innerHTML = `<div class="kv-row"><span class="kv-key">Estado</span><span class="kv-val">Desconectada</span></div>`;
            return;
        }

        const info = this.deviceInfo;
        dot.className = "status-dot connected";
        title.textContent = info.device_name || info.model;
        osChip.textContent = `OS ${info.os_version}`;
        osChip.style.display = "inline-block";

        const battLabel = info.battery > 100 ? "USB / 100%" : `${info.battery}%`;
        battChip.innerHTML = `${NaSpireUI.icon("usb", 13)} ${battLabel}`;
        battChip.style.display = "inline-flex";
        battChip.style.alignItems = "center";
        battChip.style.gap = "5px";

        btnConn.style.display = "none";
        btnDisc.style.display = "inline-flex";

        const used = Math.max(0, info.storage_total - info.storage_free);
        const pct = info.storage_total ? Math.round((used / info.storage_total) * 100) : 0;
        document.getElementById("storage-text").textContent = `${NaSpireUI.formatBytes(info.storage_total)} / ${NaSpireUI.formatBytes(info.storage_free)}`;
        document.getElementById("storage-bar").style.width = `${Math.max(4, pct)}%`;

        infoKv.innerHTML = [
            ["Modelo", info.device_name || info.model],
            ["Familia USB", `${info.family} (${info.pid})`],
            ["Versión OS", info.os_version],
            ["Boot1 / Boot2", `${info.boot1_version} / ${info.boot2_version}`],
            ["Pantalla", `${info.lcd.width}×${info.lcd.height} (${info.lcd.bpp} bpp)`],
            ["Flash Libre", `${NaSpireUI.formatBytes(info.storage_free)} / ${NaSpireUI.formatBytes(info.storage_total)}`],
            ["RAM Libre", `${NaSpireUI.formatBytes(info.ram_free)} / ${NaSpireUI.formatBytes(info.ram_total)}`],
            ["Extensión OS", info.extensions?.os || ".tcc2"],
        ]
            .map(([k, v]) => `<div class="kv-row"><span class="kv-key">${k}</span><span class="kv-val">${v}</span></div>`)
            .join("");
    },

    renderSupportedModels(list) {
        const el = document.getElementById("supported-models-list");
        el.innerHTML = list
            .map(
                (m) => `
                <div class="kv-row" style="flex-direction:column;gap:3px;">
                    <div style="display:flex;justify-content:space-between;">
                        <span style="font-weight:700;color:#fff;">${m.family}</span>
                        <span style="color:var(--success);font-size:11.5px;">${m.protocol}</span>
                    </div>
                    <span class="kv-key" style="font-size:11.5px;">${m.models.join(", ")}</span>
                </div>`
            )
            .join("");
    },
};

document.addEventListener("DOMContentLoaded", () => NaSpireApp.init());
