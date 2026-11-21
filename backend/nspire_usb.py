"""
NaSpire — Motor de comunicación USB (NavNet + NNSE) para la familia TI-Nspire.
Compatible con TI-Nspire CX II / CX II CAS / CX II-T (PID 0xE022)
y TI-Nspire CX / CX CAS / Touchpad / Clickpad (PID 0xE012).
"""

import io
import struct
import threading
import time
from typing import Any, Callable, Dict, List, Optional, Tuple

import libusb_package
import usb.core
import usb.util
from PIL import Image

NSP_VID = 0x0451
NSP_PID_CX = 0xE012
NSP_PID_CX2 = 0xE022

SUPPORTED_DEVICES = [
    {"vid": NSP_VID, "pid": NSP_PID_CX2, "family": "TI-Nspire CX II", "is_cx2": True},
    {"vid": NSP_VID, "pid": NSP_PID_CX, "family": "TI-Nspire CX / Legacy", "is_cx2": False},
]

# NNSE constants (CX II)
NNSE_ADDR_ALL = 0xFF
NNSE_ADDR_ME = 0xFE
NNSE_ADDR_CALC = 0x01

NNSE_SVC_ADDR_REQ = 0x01
NNSE_SVC_TIME = 0x02
NNSE_SVC_ECHO = 0x03
NNSE_SVC_STREAM = 0x04
NNSE_SVC_TRANSMIT = 0x05
NNSE_SVC_LOOPBACK = 0x06
NNSE_SVC_STATS = 0x07
NNSE_SVC_UNKNOWN = 0x08
NNSE_ACK_FLAG = 0x80

NNSE_HDR_FMT = "!BBBBBBHHH"
NNSE_HDR_SIZE = struct.calcsize(NNSE_HDR_FMT)  # 12 bytes

# NavNet packet header: magic, src_addr, src_sid, dst_addr, dst_sid, data_csum, size, ack, seq, hdr_csum
NAVNET_MAGIC = 0x54FD
NAVNET_HDR_FMT = "!HHHHHHBBBB"
NAVNET_HDR_SIZE = struct.calcsize(NAVNET_HDR_FMT)  # 16 bytes

# Hardware type names
HW_TYPES = {
    0x00: "TI-Nspire CAS (Clickpad)",
    0x01: "TI-Nspire (Clickpad/Touchpad)",
    0x02: "TI-Nspire CAS (Touchpad)",
    0x03: "TI-Nspire CX / CX II",
    0x04: "TI-Nspire CX CAS / CX II CAS",
    0x05: "TI-Nspire CM-C",
    0x06: "TI-Nspire CM-C CAS",
}


class NspireError(Exception):
    """Error de comunicación o protocolo con la calculadora TI-Nspire."""


def _nnse_checksum(data: bytes) -> int:
    acc = 0
    size = len(data)
    for i in range(0, size - 1, 2):
        acc += (data[i] << 8) | data[i + 1]
    if size & 1:
        acc += data[-1] << 8
    while acc >> 16:
        acc = (acc >> 16) + (acc & 0xFFFF)
    return acc & 0xFFFF


def _navnet_header_checksum(hdr_15: bytes) -> int:
    return sum(hdr_15) & 0xFF


def _navnet_data_checksum(data: bytes) -> int:
    chksum = 0
    for b in data:
        tmp1 = ((b << 8) | (chksum >> 8)) & 0xFFFF
        chksum &= 0xFF
        tmp2 = ((((chksum & 0xF) << 4) ^ chksum) << 8) & 0xFFFF
        tmp3 = (tmp2 >> 5) & 0xFFFF
        chksum = (tmp3 >> 7) & 0xFFFF
        chksum = (chksum ^ tmp1 ^ tmp2 ^ tmp3) & 0xFFFF
    return chksum


def _pack_padded_str(text: str) -> bytes:
    """Empaqueta string tipo 's' de libnspire: null-terminated, mínimo 9 bytes."""
    raw = text.encode("utf-8")
    if len(raw) < 8:
        return raw + b"\x00" * (9 - len(raw))
    return raw + b"\x00"


def _unpack_padded_str(buf: bytes, offset: int) -> Tuple[str, int]:
    """Desempaqueta string tipo 's' de libnspire."""
    null_pos = buf.find(b"\x00", offset)
    if null_pos == -1:
        raise NspireError("String sin terminador nulo en respuesta")
    s = buf[offset:null_pos].decode("utf-8", errors="replace")
    str_len = null_pos - offset
    if str_len < 8:
        new_offset = offset + 9
    else:
        new_offset = null_pos + 1
    return s, new_offset


def _unpack_cstr(buf: bytes, offset: int) -> Tuple[str, int]:
    """Desempaqueta string tipo 'S' de libnspire (null-terminated sin padding)."""
    null_pos = buf.find(b"\x00", offset)
    if null_pos == -1:
        return buf[offset:].decode("utf-8", errors="replace"), len(buf)
    return buf[offset:null_pos].decode("utf-8", errors="replace"), null_pos + 1


def _rle_decode(bpp: int, inp: bytes, out_size: int) -> bytearray:
    """Decodifica compresión RLE de capturas de pantalla TI-Nspire."""
    rle_size = (bpp * 2) // 8  # 2 pixels
    out = bytearray()
    idx = 0
    in_size = len(inp)
    while idx < in_size - 1 and len(out) < out_size:
        val = struct.unpack_from("b", inp, idx)[0]
        idx += 1
        if val < 0:
            count = (-val + 1) * rle_size
            avail_out = out_size - len(out)
            avail_in = in_size - idx
            take = min(count, avail_out, avail_in)
            out.extend(inp[idx : idx + take])
            idx += take
        else:
            if in_size - idx < rle_size:
                break
            chunk = inp[idx : idx + rle_size]
            idx += rle_size
            repeat = val + 1
            for _ in range(repeat):
                if len(out) + rle_size > out_size:
                    break
                out.extend(chunk)
    if len(out) < out_size:
        out.extend(b"\x00" * (out_size - len(out)))
    return out


class NspireClient:
    """Cliente USB thread-safe para calculadoras TI-Nspire (CX y CX II)."""

    def __init__(self) -> None:
        self._lock = threading.RLock()
        self.dev: Optional[usb.core.Device] = None
        self.ep_in: int = 0x81
        self.ep_out: int = 0x01
        self.is_cx2: bool = False
        self.pid: int = 0
        self.family: str = ""

        # NavNet state
        self.host_addr: int = 0x6400
        self.device_addr: int = 0x6401
        self.host_sid: int = 0x4003
        self.device_sid: int = 0x4003
        self.service_connected: bool = False
        self.nav_seq: int = 1

        # NNSE state (CX II)
        self.nnse_seq: int = 0
        self.cx2_handshake_complete: bool = False
        self._last_usb_addr: Optional[Tuple[Any, Any]] = None

    @property
    def is_connected(self) -> bool:
        return self.dev is not None

    @staticmethod
    def scan_devices() -> List[Dict[str, Any]]:
        """Escanea dispositivos TI-Nspire conectados sin abrirlos."""
        found = []
        backend = libusb_package.get_libusb1_backend()
        for spec in SUPPORTED_DEVICES:
            devs = list(
                usb.core.find(
                    find_all=True,
                    idVendor=spec["vid"],
                    idProduct=spec["pid"],
                    backend=backend,
                )
            )
            for d in devs:
                found.append(
                    {
                        "vid": f"0x{d.idVendor:04X}",
                        "pid": f"0x{d.idProduct:04X}",
                        "family": spec["family"],
                        "is_cx2": spec["is_cx2"],
                        "bus": getattr(d, "bus", None),
                        "address": getattr(d, "address", None),
                    }
                )
        return found

    def connect(self) -> Dict[str, Any]:
        """Conecta con la primera calculadora TI-Nspire encontrada."""
        with self._lock:
            self.disconnect()
            backend = libusb_package.get_libusb1_backend()
            if backend is None:
                raise NspireError("No se encontró el backend libusb-1.0.")

            dev = None
            chosen_spec = None
            for spec in SUPPORTED_DEVICES:
                dev = usb.core.find(
                    idVendor=spec["vid"],
                    idProduct=spec["pid"],
                    backend=backend,
                )
                if dev is not None:
                    chosen_spec = spec
                    break

            if dev is None or chosen_spec is None:
                raise NspireError(
                    "No se detectó ninguna calculadora TI-Nspire conectada por USB."
                )

            try:
                dev.set_configuration(1)
            except usb.core.USBError as exc:
                if getattr(exc, "errno", None) == 13:
                    raise NspireError(
                        "Acceso USB denegado: cierra otras ventanas de NaSpire o software de TI que estén usando la calculadora."
                    ) from exc

            try:
                cfg = dev.get_active_configuration()
                intf = cfg[(0, 0)]
                usb.util.claim_interface(dev, intf.bInterfaceNumber)
            except usb.core.USBError as exc:
                if getattr(exc, "errno", None) == 13:
                    raise NspireError(
                        "Acceso USB denegado: cierra otras ventanas de NaSpire o software de TI que estén usando la calculadora."
                    ) from exc
                raise NspireError(f"No se pudo abrir la interfaz USB: {exc}") from exc

            ep_in = usb.util.find_descriptor(
                intf,
                custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress)
                == usb.util.ENDPOINT_IN,
            )
            ep_out = usb.util.find_descriptor(
                intf,
                custom_match=lambda e: usb.util.endpoint_direction(e.bEndpointAddress)
                == usb.util.ENDPOINT_OUT,
            )
            if ep_in is None or ep_out is None:
                usb.util.dispose_resources(dev)
                raise NspireError("No se encontraron endpoints Bulk IN/OUT en el dispositivo USB.")

            try:
                dev.clear_halt(ep_in.bEndpointAddress)
                dev.clear_halt(ep_out.bEndpointAddress)
            except Exception:
                pass

            self.dev = dev
            self.ep_in = ep_in.bEndpointAddress
            self.ep_out = ep_out.bEndpointAddress
            self.is_cx2 = chosen_spec["is_cx2"]
            self.pid = chosen_spec["pid"]
            self.family = chosen_spec["family"]

            self.host_addr = 0x6400
            self.device_addr = 0x6401
            self.host_sid = 0x4003
            self.device_sid = 0x4003
            self.service_connected = False
            self.nav_seq = 1
            self.nnse_seq = 0
            self.cx2_handshake_complete = False

            try:
                if not self.is_cx2:
                    # Legacy CX: espera solicitud de dirección inicial
                    self._packet_recv()

                # Enviar asignación de dirección NavNet
                self._packet_send_raw(
                    src_addr=self.host_addr,
                    src_sid=self.host_sid,
                    dst_addr=self.device_addr,
                    dst_sid=self.device_sid,
                    payload=bytes([0x64, 0x01, 0xFF, 0x00]),
                    ack=0,
                    seq=0 if self.is_cx2 else self.nav_seq,
                )
                self.host_sid = 0x8000
                info = self.get_device_info()
                return info
            except usb.core.USBTimeoutError as exc:
                self.disconnect()
                raise NspireError(
                    "La calculadora no respondió por USB (timeout). Verifica que esté encendida e intenta de nuevo."
                ) from exc
            except Exception as exc:
                self.disconnect()
                raise NspireError(f"Error durante el handshake USB: {exc}") from exc

    def disconnect(self) -> None:
        with self._lock:
            if self.dev is not None:
                try:
                    usb.util.release_interface(self.dev, 0)
                except Exception:
                    pass
                try:
                    usb.util.dispose_resources(self.dev)
                except Exception:
                    pass
                self.dev = None
            self.service_connected = False
            self.cx2_handshake_complete = False

    # ------------------------------------------------------------------
    # Capa NNSE (TI-Nspire CX II)
    # ------------------------------------------------------------------
    def _next_nnse_seq(self) -> int:
        s = self.nnse_seq
        self.nnse_seq = (self.nnse_seq + 1) & 0xFFFF
        return s

    def _nnse_write_packet(
        self,
        service: int,
        src: int,
        dest: int,
        req_ack: int,
        seqno: int,
        payload: bytes = b"",
        misc: int = 0,
        unknown: int = 0,
    ) -> None:
        assert self.dev is not None
        length = NNSE_HDR_SIZE + len(payload)
        hdr_zero = struct.pack(
            NNSE_HDR_FMT,
            misc,
            service,
            src,
            dest,
            unknown,
            req_ack,
            length,
            seqno,
            0,
        )
        pkt_zero = hdr_zero + payload
        csum = _nnse_checksum(pkt_zero) ^ 0xFFFF
        hdr = struct.pack(
            NNSE_HDR_FMT,
            misc,
            service,
            src,
            dest,
            unknown,
            req_ack,
            length,
            seqno,
            csum,
        )
        pkt = hdr + payload
        written = self.dev.write(self.ep_out, pkt, timeout=5000)
        if written != len(pkt):
            raise NspireError(f"Escritura NNSE incompleta ({written}/{len(pkt)})")

    def _nnse_read_packet(self, timeout: int = 10000) -> Tuple[Tuple[int, ...], bytes]:
        assert self.dev is not None
        maxlen = NNSE_HDR_SIZE + 1472
        raw = bytes(self.dev.read(self.ep_in, maxlen, timeout=timeout))
        if len(raw) < NNSE_HDR_SIZE:
            raise NspireError("Paquete NNSE demasiado corto")

        hdr = struct.unpack_from(NNSE_HDR_FMT, raw, 0)
        complete_len = hdr[6]
        if complete_len < NNSE_HDR_SIZE or complete_len > maxlen:
            raise NspireError(f"Longitud NNSE inválida: {complete_len}")

        buf = bytearray(raw)
        while len(buf) < complete_len:
            chunk = bytes(
                self.dev.read(self.ep_in, complete_len - len(buf), timeout=2000)
            )
            buf.extend(chunk)

        full = bytes(buf[:complete_len])
        if _nnse_checksum(full) != 0xFFFF:
            raise NspireError("Checksum NNSE inválido")

        return hdr, full[NNSE_HDR_SIZE:]

    def _nnse_handle_packet(
        self, hdr: Tuple[int, ...], payload: bytes
    ) -> Optional[bytes]:
        misc, service, src, dest, unknown, req_ack, length, seqno, csum = hdr
        if dest != NNSE_ADDR_ME and dest != NNSE_ADDR_ALL:
            return None

        if service & NNSE_ACK_FLAG:
            return None

        if req_ack & 1:
            self._nnse_write_packet(
                service=service | NNSE_ACK_FLAG,
                src=dest,
                dest=src,
                req_ack=req_ack & ~1,
                seqno=seqno,
                payload=b"",
                misc=misc,
                unknown=unknown,
            )

        base_svc = service & ~NNSE_ACK_FLAG
        if base_svc == NNSE_SVC_ADDR_REQ:
            if len(payload) >= 1 and payload[0] == 0x00:
                # Enviar respuesta dos veces como en libnspire
                for _ in range(2):
                    self._nnse_write_packet(
                        service=service,
                        src=NNSE_ADDR_ME,
                        dest=NNSE_ADDR_CALC,
                        req_ack=0,
                        seqno=self._next_nnse_seq(),
                        payload=bytes([0x80]),
                    )
        elif base_svc == NNSE_SVC_TIME:
            if len(payload) >= 1 and payload[0] == 0x00:
                now_sec = int(time.time()) & 0xFFFFFFFF
                resp_payload = struct.pack("!BIQI", 0x80, now_sec, 0, 0)
                self._nnse_write_packet(
                    service=service,
                    src=NNSE_ADDR_ME,
                    dest=NNSE_ADDR_CALC,
                    req_ack=0,
                    seqno=self._next_nnse_seq(),
                    payload=resp_payload,
                )
                self.cx2_handshake_complete = True
        elif base_svc == NNSE_SVC_UNKNOWN:
            if len(payload) == 1 and payload[0] == 0x01:
                self._nnse_write_packet(
                    service=service,
                    src=NNSE_ADDR_ME,
                    dest=NNSE_ADDR_CALC,
                    req_ack=0,
                    seqno=self._next_nnse_seq(),
                    payload=bytes([0x81, 0x03]),
                )
        elif base_svc == NNSE_SVC_STREAM:
            return payload

        return None

    def _cx2_assure_ready(self) -> None:
        if self.cx2_handshake_complete:
            return
        sent_release = False
        for attempt in range(14):
            if self.cx2_handshake_complete:
                return
            try:
                # Espera breve primero; si ya había sesión previa, enviamos AddrRelease (0x01)
                t_ms = 350 if (attempt == 0 and not sent_release) else 1500
                hdr, payload = self._nnse_read_packet(timeout=t_ms)
                self._nnse_handle_packet(hdr, payload)
            except usb.core.USBTimeoutError:
                if not sent_release:
                    # Forzar a la CX II a reiniciar el handshake NNSE sin desenchufar el cable
                    self._nnse_write_packet(
                        service=NNSE_SVC_ADDR_REQ,
                        src=NNSE_ADDR_ME,
                        dest=NNSE_ADDR_CALC,
                        req_ack=0,
                        seqno=self._next_nnse_seq(),
                        payload=bytes([NNSE_ADDR_CALC]),
                    )
                    sent_release = True
                    continue
                break
        if not self.cx2_handshake_complete:
            raise NspireError(
                "No se pudo completar el handshake NNSE con la CX II. Asegúrate de que la calculadora esté encendida."
            )

    def _cx2_send(self, data: bytes) -> None:
        self._cx2_assure_ready()
        seqno = self._next_nnse_seq()
        self._nnse_write_packet(
            service=NNSE_SVC_STREAM,
            src=NNSE_ADDR_ME,
            dest=NNSE_ADDR_CALC,
            req_ack=1,
            seqno=seqno,
            payload=data,
        )
        for _ in range(8):
            hdr, payload = self._nnse_read_packet(timeout=1500)
            self._nnse_handle_packet(hdr, payload)
            _, service, _, dest, _, _, _, r_seq, _ = hdr
            if (
                dest == NNSE_ADDR_ME
                and service == (NNSE_SVC_STREAM | NNSE_ACK_FLAG)
                and r_seq == seqno
            ):
                return
        raise NspireError("No se recibió ACK NNSE de la calculadora.")

    def _cx2_recv(self) -> bytes:
        self._cx2_assure_ready()
        for _ in range(15):
            hdr, payload = self._nnse_read_packet(timeout=10000)
            stream = self._nnse_handle_packet(hdr, payload)
            if stream is not None:
                return stream
        raise NspireError("No se recibió paquete Stream NNSE de la calculadora.")

    # ------------------------------------------------------------------
    # Capa NavNet (común a CX y CX II)
    # ------------------------------------------------------------------
    def _max_datasize(self) -> int:
        return 1440 if self.is_cx2 else 254

    def _packet_send_raw(
        self,
        src_addr: int,
        src_sid: int,
        dst_addr: int,
        dst_sid: int,
        payload: bytes,
        ack: int = 0,
        seq: int = 0,
    ) -> None:
        if len(payload) < 0xFF:
            data_size = len(payload)
            fulldata = payload
        else:
            if len(payload) > self._max_datasize():
                raise NspireError(f"Payload demasiado grande: {len(payload)}")
            data_size = 0xFF
            fulldata = struct.pack("!I", len(payload)) + payload

        data_csum = _navnet_data_checksum(fulldata)
        hdr_15 = struct.pack(
            "!HHHHHHBBB",
            NAVNET_MAGIC,
            src_addr,
            src_sid,
            dst_addr,
            dst_sid,
            data_csum,
            data_size,
            ack,
            seq,
        )
        hdr_csum = _navnet_header_checksum(hdr_15)
        raw_pkt = hdr_15 + bytes([hdr_csum]) + fulldata

        if self.is_cx2:
            self._cx2_send(raw_pkt)
        else:
            assert self.dev is not None
            written = self.dev.write(self.ep_out, raw_pkt, timeout=10000)
            if written != len(raw_pkt):
                raise NspireError("Escritura USB NavNet incompleta")

    def _packet_recv(self) -> Dict[str, Any]:
        if self.is_cx2:
            raw = self._cx2_recv()
        else:
            assert self.dev is not None
            raw = bytes(self.dev.read(self.ep_in, NAVNET_HDR_SIZE + 1444, timeout=10000))

        if len(raw) < NAVNET_HDR_SIZE:
            raise NspireError("Paquete NavNet demasiado corto")

        (
            magic,
            src_addr,
            src_sid,
            dst_addr,
            dst_sid,
            data_csum,
            data_size,
            ack,
            seq,
            hdr_csum,
        ) = struct.unpack_from(NAVNET_HDR_FMT, raw, 0)

        if magic != NAVNET_MAGIC:
            raise NspireError(f"Magic NavNet inválido: 0x{magic:04X}")
        if _navnet_header_checksum(raw[:15]) != hdr_csum:
            raise NspireError("Header checksum NavNet inválido")

        if data_size == 0xFF:
            big_len = struct.unpack_from("!I", raw, NAVNET_HDR_SIZE)[0]
            fulldata = raw[NAVNET_HDR_SIZE : NAVNET_HDR_SIZE + 4 + big_len]
            data = fulldata[4:]
        else:
            fulldata = raw[NAVNET_HDR_SIZE : NAVNET_HDR_SIZE + data_size]
            data = fulldata

        if _navnet_data_checksum(fulldata) != data_csum:
            raise NspireError("Data checksum NavNet inválido")

        return {
            "src_addr": src_addr,
            "src_sid": src_sid,
            "dst_addr": dst_addr,
            "dst_sid": dst_sid,
            "ack": ack,
            "seq": seq,
            "data": data,
        }

    def _packet_ack(self, pkt: Dict[str, Any], is_nack: bool = False) -> None:
        src_sid = 0xD3 if is_nack else (0xFF if pkt["seq"] else 0xFE)
        payload = struct.pack("!H", pkt["dst_sid"])
        self._packet_send_raw(
            src_addr=self.host_addr,
            src_sid=src_sid,
            dst_addr=self.device_addr,
            dst_sid=pkt["src_sid"],
            payload=payload,
            ack=0x0A,
            seq=pkt["seq"],
        )

    def _handle_unknown_pkt(self, pkt: Dict[str, Any]) -> None:
        if pkt["dst_sid"] == 0x40DE:
            self._packet_ack(pkt, is_nack=False)
        else:
            self._packet_ack(pkt, is_nack=True)

    def _data_write(self, payload: bytes, src_sid_override: Optional[int] = None) -> None:
        src_sid = src_sid_override if src_sid_override is not None else self.host_sid
        self._packet_send_raw(
            src_addr=self.host_addr,
            src_sid=src_sid,
            dst_addr=self.device_addr,
            dst_sid=self.device_sid,
            payload=payload,
            ack=0,
            seq=0 if self.is_cx2 else self.nav_seq,
        )
        if self.is_cx2:
            return

        while True:
            pkt = self._packet_recv()
            if pkt["dst_sid"] == self.host_sid:
                if pkt["src_sid"] in (0xFF, 0xFE):
                    self.nav_seq = (self.nav_seq + 1) & 0xFF
                    if self.nav_seq == 0:
                        self.nav_seq = 1
                    return
                if pkt["src_sid"] == 0xD3:
                    raise NspireError("Calculadora respondió NACK")
            else:
                self._handle_unknown_pkt(pkt)

    def _data_read(self) -> bytes:
        while True:
            pkt = self._packet_recv()
            if pkt["dst_sid"] == self.host_sid:
                if not self.is_cx2:
                    self._packet_ack(pkt, is_nack=False)
                return pkt["data"]
            self._handle_unknown_pkt(pkt)

    def _service_connect(self, sid: int) -> None:
        if self.service_connected:
            raise NspireError("Ya hay un servicio activo")
        self.service_connected = True
        self.device_sid = sid

    def _service_disconnect(self) -> None:
        if not self.service_connected:
            return
        try:
            payload = struct.pack("!H", self.host_sid)
            self._data_write(payload, src_sid_override=0x40DE)
        finally:
            self.service_connected = False
            self.host_sid = (self.host_sid + 1) & 0xFFFF
            if self.host_sid < 0x8000:
                self.host_sid = 0x8000

    # ------------------------------------------------------------------
    # Servicios de alto nivel
    # ------------------------------------------------------------------
    def get_device_info(self) -> Dict[str, Any]:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            self._service_connect(0x4020)
            try:
                self._data_write(b"\x01")
                buf = self._data_read()
                if len(buf) < 70:
                    raise NspireError("Respuesta device_info incompleta")

                # Shift 1 byte as in libnspire
                d = buf[1:]
                (
                    flash_free,
                    flash_total,
                    ram_free,
                    ram_total,
                    batt_lvl,
                    _pad,
                    is_charging,
                    clock_speed,
                ) = struct.unpack_from("!QQQQBBBB", d, 0)

                os_ver = f"{d[36]}.{d[37]}.{(d[38] << 8) | d[39]}"
                boot1_ver = f"{d[40]}.{d[41]}.{(d[42] << 8) | d[43]}"
                boot2_ver = f"{d[44]}.{d[45]}.{(d[46] << 8) | d[47]}"
                run_level = struct.unpack_from("!H", d, 52)[0]
                lcd_x, lcd_y, lcd_w, lcd_h, lcd_bpp, lcd_mode, hw_type = (
                    struct.unpack_from("!HHHHBBB", d, 54)
                )

                # Device name
                self._data_write(b"\x02")
                buf2 = self._data_read()
                dev_name, _ = _unpack_cstr(buf2, 1)

                # Extensions
                self._data_write(b"\x03")
                buf3 = self._data_read()
                ext_file, off = _unpack_cstr(buf3, 1)
                ext_os, _ = _unpack_cstr(buf3, off)

                model_name = HW_TYPES.get(hw_type, self.family)
                if self.is_cx2:
                    if hw_type == 0x04:
                        model_name = "TI-Nspire CX II CAS"
                    elif hw_type == 0x03:
                        model_name = "TI-Nspire CX II"

                return {
                    "connected": True,
                    "device_name": dev_name or model_name,
                    "model": model_name,
                    "family": self.family,
                    "is_cx2": self.is_cx2,
                    "pid": f"0x{self.pid:04X}",
                    "os_version": os_ver,
                    "boot1_version": boot1_ver,
                    "boot2_version": boot2_ver,
                    "battery": batt_lvl,
                    "is_charging": bool(is_charging),
                    "storage_free": flash_free,
                    "storage_total": flash_total,
                    "ram_free": ram_free,
                    "ram_total": ram_total,
                    "lcd": {
                        "width": lcd_w,
                        "height": lcd_h,
                        "bpp": lcd_bpp,
                    },
                    "extensions": {
                        "file": ext_file,
                        "os": ext_os,
                    },
                    "run_level": run_level,
                }
            finally:
                self._service_disconnect()

    def list_dir(self, path: str = "/") -> List[Dict[str, Any]]:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            norm_path = path if path.startswith("/") else "/" + path
            self._service_connect(0x4060)
            try:
                req = b"\x0D" + _pack_padded_str(norm_path) + b"\x00"
                self._data_write(req)
                resp = self._data_read()
                if len(resp) >= 2:
                    code = resp[1]
                    if code == 0x0A:
                        raise NspireError(f"La carpeta '{norm_path}' no existe.")
                    if code == 0x0F:
                        raise NspireError(f"Ruta inválida: '{norm_path}'")

                items: List[Dict[str, Any]] = []
                while True:
                    self._data_write(b"\x0E")
                    entry = self._data_read()
                    if not entry or entry[0] == 0xFF:
                        break
                    # Format: hbswwb0 -> skip 3 bytes (h + b), then padded string 's', then w(size), w(date), b(is_dir), 0
                    name, off = _unpack_padded_str(entry, 3)
                    size, date, is_dir = struct.unpack_from("!IIB", entry, off)
                    full_path = (
                        f"/{name}"
                        if norm_path == "/"
                        else f"{norm_path.rstrip('/')}/{name}"
                    )
                    items.append(
                        {
                            "name": name,
                            "path": full_path,
                            "size": size,
                            "date": date,
                            "is_dir": bool(is_dir),
                        }
                    )

                # End dir enum
                self._data_write(b"\x0F")
                self._data_read()

                # Ordenar carpetas primero y luego alfabéticamente
                items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
                return items
            finally:
                self._service_disconnect()

    def create_dir(self, path: str) -> None:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            norm_path = path if path.startswith("/") else "/" + path
            self._service_connect(0x4060)
            try:
                req = struct.pack("!H", 0x0A03) + _pack_padded_str(norm_path)
                self._data_write(req)
                resp = self._data_read()
                res = struct.unpack_from("!H", resp, 0)[0]
                if res != 0xFF00:
                    raise NspireError(f"No se pudo crear la carpeta (código 0x{res:04X})")
            finally:
                self._service_disconnect()

    def delete_dir(self, path: str) -> None:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            norm_path = path if path.startswith("/") else "/" + path
            self._service_connect(0x4060)
            try:
                req = struct.pack("!H", 0x0B03) + _pack_padded_str(norm_path)
                self._data_write(req)
                resp = self._data_read()
                res = struct.unpack_from("!H", resp, 0)[0]
                if res != 0xFF00:
                    raise NspireError(
                        f"No se pudo eliminar la carpeta (¿está vacía? código 0x{res:04X})"
                    )
            finally:
                self._service_disconnect()

    def delete_file(self, path: str) -> None:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            norm_path = path if path.startswith("/") else "/" + path
            self._service_connect(0x4060)
            try:
                req = struct.pack("!H", 0x0901) + _pack_padded_str(norm_path) + b"\x00"
                self._data_write(req)
                resp = self._data_read()
                res = struct.unpack_from("!H", resp, 0)[0]
                if res != 0xFF00:
                    raise NspireError(f"No se pudo eliminar el archivo (código 0x{res:04X})")
            finally:
                self._service_disconnect()

    def move_file(self, src: str, dst: str) -> None:
        """Mueve o renombra un archivo/carpeta en la calculadora."""
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            s = src if src.startswith("/") else "/" + src
            d = dst if dst.startswith("/") else "/" + dst
            self._service_connect(0x4060)
            try:
                req = (
                    struct.pack("!H", 0x2101)
                    + _pack_padded_str(s)
                    + _pack_padded_str(d)
                    + b"\x00"
                )
                self._data_write(req)
                resp = self._data_read()
                res = struct.unpack_from("!H", resp, 0)[0]
                if res != 0xFF00:
                    raise NspireError(f"No se pudo mover/renombrar (código 0x{res:04X})")
            finally:
                self._service_disconnect()

    def copy_file(self, src: str, dst: str) -> None:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            s = src if src.startswith("/") else "/" + src
            d = dst if dst.startswith("/") else "/" + dst
            self._service_connect(0x4060)
            try:
                req = (
                    struct.pack("!H", 0x0C01)
                    + _pack_padded_str(s)
                    + _pack_padded_str(d)
                    + b"\x00"
                )
                self._data_write(req)
                resp = self._data_read()
                res = struct.unpack_from("!H", resp, 0)[0]
                if res != 0xFF00:
                    raise NspireError(f"No se pudo copiar (código 0x{res:04X})")
            finally:
                self._service_disconnect()

    def write_file(
        self,
        path: str,
        data: bytes,
        progress_cb: Optional[Callable[[int, int], None]] = None,
    ) -> None:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            norm_path = path if path.startswith("/") else "/" + path
            total = len(data)
            self._service_connect(0x4060)
            try:
                req = (
                    struct.pack("!H", 0x0301)
                    + _pack_padded_str(norm_path)
                    + struct.pack("!I", total)
                )
                self._data_write(req)
                resp = self._data_read()
                if not resp or resp[0] != 0x04:
                    raise NspireError("La calculadora rechazó el inicio de escritura.")

                chunk_size = self._max_datasize() - 1
                sent = 0
                while sent < total:
                    part = data[sent : sent + chunk_size]
                    self._data_write(b"\x05" + part)
                    sent += len(part)
                    if progress_cb:
                        progress_cb(sent, total)

                resp_end = self._data_read()
                res = struct.unpack_from("!H", resp_end, 0)[0]
                if res != 0xFF00:
                    raise NspireError(f"Error al finalizar escritura (código 0x{res:04X})")
            finally:
                self._service_disconnect()

    def read_file(self, path: str) -> bytes:
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            norm_path = path if path.startswith("/") else "/" + path
            self._service_connect(0x4060)
            try:
                req = struct.pack("!H", 0x0701) + _pack_padded_str(norm_path)
                self._data_write(req)
                resp = self._data_read()
                if len(resp) < 15:
                    raise NspireError("Respuesta de lectura inválida")
                result = struct.unpack_from("!H", resp, 0)[0]
                if result != 0x0301:
                    raise NspireError(f"Archivo no encontrado o ilegible: {norm_path}")
                data_len = struct.unpack_from("!I", resp, 11)[0]

                self._data_write(b"\x04")
                out = bytearray()
                remaining = data_len
                while remaining > 0:
                    pkt = self._data_read()
                    chunk = pkt[1:]
                    take = min(len(chunk), remaining)
                    out.extend(chunk[:take])
                    remaining -= take

                self._data_write(struct.pack("!H", 0xFF00))
                return bytes(out)
            finally:
                self._service_disconnect()

    def screenshot_png(self) -> Tuple[bytes, int, int]:
        """Captura la pantalla actual de la calculadora y la devuelve como PNG."""
        with self._lock:
            if not self.is_connected:
                raise NspireError("Calculadora no conectada")
            self._service_connect(0x4024)
            try:
                self._data_write(b"\x00")
                hdr = self._data_read()
                if len(hdr) < 15:
                    raise NspireError("Cabecera de screenshot incompleta")

                # Format: b w h h h h b b
                _, comp_size, _, _, width, height, bpp, _ = struct.unpack_from(
                    "!BIHHHHBB", hdr, 0
                )

                comp_buf = bytearray()
                remaining = comp_size
                maxsize = self._max_datasize() - 1
                while remaining > 0:
                    pkt = self._data_read()
                    take = min(maxsize, remaining, len(pkt) - 1)
                    comp_buf.extend(pkt[1 : 1 + take])
                    remaining -= take

                out_size = (width * height * bpp) // 8
                raw_pixels = _rle_decode(bpp, bytes(comp_buf), out_size)

                img = self._pixels_to_image(raw_pixels, width, height, bpp)
                bio = io.BytesIO()
                img.save(bio, format="PNG")
                return bio.getvalue(), width, height
            finally:
                self._service_disconnect()

    @staticmethod
    def _pixels_to_image(raw: bytearray, width: int, height: int, bpp: int) -> Image.Image:
        if bpp == 16:
            # RGB565 (little-endian en TI-Nspire CX / CX II)
            rgb = bytearray(width * height * 3)
            out_i = 0
            for i in range(0, len(raw) - 1, 2):
                val = raw[i] | (raw[i + 1] << 8)
                r = ((val >> 11) & 0x1F) * 255 // 31
                g = ((val >> 5) & 0x3F) * 255 // 63
                b = (val & 0x1F) * 255 // 31
                rgb[out_i] = r
                rgb[out_i + 1] = g
                rgb[out_i + 2] = b
                out_i += 3
            return Image.frombytes("RGB", (width, height), bytes(rgb))
        elif bpp == 4:
            # 4-bit grayscale (Clickpad / Touchpad)
            gray = bytearray(width * height)
            out_i = 0
            for byte in raw:
                if out_i < len(gray):
                    gray[out_i] = ((byte >> 4) & 0x0F) * 17
                    out_i += 1
                if out_i < len(gray):
                    gray[out_i] = (byte & 0x0F) * 17
                    out_i += 1
            return Image.frombytes("L", (width, height), bytes(gray)).convert("RGB")
        else:
            raise NspireError(f"Formato de color no soportado: {bpp} bpp")
