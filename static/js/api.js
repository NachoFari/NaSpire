/**
 * Módulo API REST de NaSpire
 */
window.NaSpireAPI = {
    async request(url, options = {}) {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json", ...(options.headers || {}) },
            ...options,
        });
        const data = await res.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor" }));
        if (!res.ok || data.ok === false) {
            throw new Error(data.error || `Error HTTP ${res.status}`);
        }
        return data;
    },

    health() { return this.request("/api/health"); },
    scanDevices() { return this.request("/api/devices/scan"); },
    deviceInfo() { return this.request("/api/device/info"); },
    connect() { return this.request("/api/device/connect", { method: "POST", body: "{}" }); },
    disconnect() { return this.request("/api/device/disconnect", { method: "POST", body: "{}" }); },

    listDir(path) {
        return this.request(`/api/files/list?path=${encodeURIComponent(path)}`);
    },
    listFolders() {
        return this.request("/api/files/folders");
    },
    getTnsTags(path, size) {
        return this.request(`/api/files/tns-tags?path=${encodeURIComponent(path)}&size=${encodeURIComponent(size || 0)}`);
    },
    mkdir(path) {
        return this.request("/api/files/mkdir", { method: "POST", body: JSON.stringify({ path }) });
    },
    deleteItem(path, is_dir) {
        return this.request("/api/files/delete", { method: "POST", body: JSON.stringify({ path, is_dir }) });
    },
    moveItem(src, dst) {
        return this.request("/api/files/move", { method: "POST", body: JSON.stringify({ src, dst }) });
    },
    copyItem(src, dst) {
        return this.request("/api/files/copy", { method: "POST", body: JSON.stringify({ src, dst }) });
    },
    uploadFile(path, content_base64) {
        return this.request("/api/files/upload", {
            method: "POST",
            body: JSON.stringify({ path, content_base64 }),
        });
    },
    downloadUrl(path) {
        return `/api/files/download?path=${encodeURIComponent(path)}`;
    },

    screenshot() { return this.request("/api/screenshot"); },
    buildTns(payload) {
        return this.request("/api/tns/build", { method: "POST", body: JSON.stringify(payload) });
    },
    inspectTns(payload) {
        return this.request("/api/tns/inspect", { method: "POST", body: JSON.stringify(payload) });
    },
    prettyXml(xml) {
        return this.request("/api/tns/pretty", { method: "POST", body: JSON.stringify({ xml }) });
    },
    saveTns(payload) {
        return this.request("/api/tns/save", { method: "POST", body: JSON.stringify(payload) });
    },
    checkUpdates() {
        return this.request("/api/updater/check");
    },
    installUpdate(installer_url, installer_name) {
        return this.request("/api/updater/install", {
            method: "POST",
            body: JSON.stringify({ installer_url, installer_name }),
        });
    },
    openExternal(url) {
        return this.request("/api/open-external", { method: "POST", body: JSON.stringify({ url }) });
    },

    profilesList() { return this.request("/api/profiles/list"); },
    profilesAddRow() { return this.request("/api/profiles/add-row", { method: "POST", body: "{}" }); },
    profilesReorder(ordered_ids) {
        return this.request("/api/profiles/reorder", { method: "POST", body: JSON.stringify({ ordered_ids }) });
    },
    profilesRename(slot_id, name, theme) {
        return this.request("/api/profiles/rename", { method: "POST", body: JSON.stringify({ slot_id, name, theme }) });
    },
    profilesClear(slot_id) {
        return this.request("/api/profiles/clear", { method: "POST", body: JSON.stringify({ slot_id }) });
    },
    profilesContents(slot_id) {
        return this.request(`/api/profiles/contents?slot_id=${encodeURIComponent(slot_id)}`);
    },
    profilesMkdir(slot_id, path) {
        return this.request("/api/profiles/mkdir", { method: "POST", body: JSON.stringify({ slot_id, path }) });
    },
    profilesAddFile(payload) {
        return this.request("/api/profiles/add-file", { method: "POST", body: JSON.stringify(payload) });
    },
    profilesDeleteFile(slot_id, path) {
        return this.request("/api/profiles/delete-file", { method: "POST", body: JSON.stringify({ slot_id, path }) });
    },
    profilesSave(slot_id, protect_ndless) {
        return this.request("/api/profiles/save", { method: "POST", body: JSON.stringify({ slot_id, protect_ndless }) });
    },
    profilesLoad(slot_id, protect_ndless) {
        return this.request("/api/profiles/load", { method: "POST", body: JSON.stringify({ slot_id, protect_ndless }) });
    },
    profilesProgress(slot_id) {
        return this.request(`/api/profiles/progress?slot_id=${encodeURIComponent(slot_id)}`);
    },
};
