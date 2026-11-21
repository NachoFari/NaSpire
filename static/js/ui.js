/**
 * Módulo UI: Toasts, Modales, Splash y Helpers
 */
window.NaSpireUI = {
    icon(name, size = 16) {
        return `<img class="px-icon" src="/static/img/icons/${name}.png" width="${size}" height="${size}" alt="" />`;
    },

    toast(message, type = "info") {
        const container = document.getElementById("toast-container");
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => {
            el.style.opacity = "0";
            el.style.transform = "translateY(8px)";
            el.style.transition = "all 0.25s ease";
            setTimeout(() => el.remove(), 260);
        }, 3400);
    },

    setSplash(percent, text) {
        const bar = document.getElementById("splash-bar");
        const status = document.getElementById("splash-status");
        if (bar) bar.style.width = `${percent}%`;
        if (status && text) status.textContent = text;
    },

    hideSplash() {
        const el = document.getElementById("splash-screen");
        if (el) el.classList.add("hidden");
    },

    formatBytes(bytes) {
        if (!bytes || bytes <= 0) return "0 B";
        const units = ["B", "KB", "MB", "GB"];
        const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
        return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
    },

    promptModal({ title, desc = "", defaultValue = "", confirmText = "Confirmar" }) {
        return new Promise((resolve) => {
            const backdrop = document.getElementById("modal-backdrop");
            const titleEl = document.getElementById("modal-title");
            const descEl = document.getElementById("modal-desc");
            const inputEl = document.getElementById("modal-input");
            const btnCancel = document.getElementById("modal-cancel");
            const btnConfirm = document.getElementById("modal-confirm");

            titleEl.textContent = title;
            descEl.textContent = desc;
            inputEl.value = defaultValue;
            btnConfirm.textContent = confirmText;
            backdrop.classList.add("open");
            setTimeout(() => { inputEl.focus(); inputEl.select(); }, 30);

            const cleanup = (val) => {
                backdrop.classList.remove("open");
                btnCancel.onclick = null;
                btnConfirm.onclick = null;
                inputEl.onkeydown = null;
                resolve(val);
            };

            btnCancel.onclick = () => cleanup(null);
            btnConfirm.onclick = () => cleanup(inputEl.value.trim());
            inputEl.onkeydown = (e) => {
                if (e.key === "Enter") cleanup(inputEl.value.trim());
                if (e.key === "Escape") cleanup(null);
            };
        });
    },

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const res = String(reader.result || "");
                const idx = res.indexOf(",");
                resolve(idx >= 0 ? res.slice(idx + 1) : res);
            };
            reader.onerror = () => reject(new Error("Error leyendo archivo local"));
            reader.readAsDataURL(file);
        });
    },

    downloadBase64File(filename, b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
};
