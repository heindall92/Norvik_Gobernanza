# Paquetes de distribución — Norvik v1.0.0

Binarios Windows 64-bit compilados con PyInstaller (Python 3.14 + PySide6).

| Archivo | Versión | Descripción |
|---------|---------|-------------|
| `Norvik-v1.0.0-production-win64.zip` | Producción | Sin datos ficticios. Dashboard vacío hasta evaluar. Datos en `%APPDATA%\Norvik\` |
| `Norvik-v1.0.0-demo-win64.zip` | Demo | Datos ficticios precargados, badge DEMO. Datos en `%APPDATA%\Norvik-Demo\` |

## Instalación

1. Descarga el ZIP según tu caso (demo o producción).
2. Extrae en una carpeta local (p. ej. `C:\Program Files\Norvik\`).
3. Ejecuta `Norvik.exe` o `Norvik-Demo.exe` desde la carpeta extraída.

> No muevas solo el `.exe`: la carpeta `_internal` es obligatoria.

## Requisitos

- Windows 10/11 (64 bits)
- [Ollama](https://ollama.com/) opcional para funciones de IA

## Licencia

Software propietario. Ver [LICENSE](../LICENSE) y [COMMERCIAL_LICENSE.md](../COMMERCIAL_LICENSE.md).
