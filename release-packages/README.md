# Paquetes de distribución — Norvik

Binarios Windows 64-bit compilados con PyInstaller (Python 3.14 + PySide6).

| Archivo | Versión | Descripción |
|---------|---------|-------------|
| `Norvik-v1.0.1-production-win64.zip` | **Producción (actual)** | Sin datos personales ni evaluaciones. Reset de fábrica al primer arranque. Datos en `%APPDATA%\Norvik\` |
| `Norvik-v1.0.0-production-win64.zip` | Producción (obsoleto) | No usar — podía mostrar datos de desarrollo |
| `Norvik-v1.0.0-demo-win64.zip` | Demo | Datos ficticios precargados, badge DEMO. Datos en `%APPDATA%\Norvik-Demo\` |

## Instalación (producción)

1. Descarga `Norvik-v1.0.1-production-win64.zip`.
2. Extrae en una carpeta local (p. ej. `C:\Program Files\Norvik\`).
3. Ejecuta `Norvik.exe` desde la carpeta extraída.

Al **primer arranque** la app queda en estado limpio: sin foto de perfil, sin evaluaciones previas y con valores genéricos. El desarrollo local (`python main.py`) usa `%APPDATA%\Norvik-Dev\` y no contamina la build de producción.

> No muevas solo el `.exe`: la carpeta `_internal` es obligatoria.

## Requisitos

- Windows 10/11 (64 bits)
- [Ollama](https://ollama.com/) opcional para funciones de IA

## Licencia

Software propietario. Ver [LICENSE](../LICENSE) y [COMMERCIAL_LICENSE.md](../COMMERCIAL_LICENSE.md).
