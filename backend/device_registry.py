"""
Registro modular de modelos y familias de calculadoras compatibles con NaSpire.
Permite agregar nuevos modelos/protocolos sin tocar el servidor ni la interfaz.
"""

from typing import Any, Dict, List
from backend.nspire_usb import SUPPORTED_DEVICES


def get_supported_models() -> List[Dict[str, Any]]:
    return [
        {
            "family": "TI-Nspire CX II Series",
            "models": ["TI-Nspire CX II CAS", "TI-Nspire CX II", "TI-Nspire CX II-T"],
            "vid": "0x0451",
            "pid": "0xE022",
            "protocol": "NNSE + NavNet",
            "status": "Soportado",
        },
        {
            "family": "TI-Nspire CX / Legacy Series",
            "models": ["TI-Nspire CX CAS", "TI-Nspire CX", "TI-Nspire Touchpad", "TI-Nspire Clickpad"],
            "vid": "0x0451",
            "pid": "0xE012",
            "protocol": "NavNet",
            "status": "Soportado",
        },
    ]


def get_raw_usb_specs() -> List[Dict[str, Any]]:
    return SUPPORTED_DEVICES
