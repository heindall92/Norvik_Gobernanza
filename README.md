# Norvik — Governance & Compliance

**Norvik** es una aplicación de escritorio para **gobernanza, riesgo y cumplimiento (GRC)**. Permite evaluar madurez bajo marcos normativos, visualizar brechas, generar informes PDF con análisis asistido por IA y gestionar evidencias de cumplimiento.

Desarrollado por [Yoandy Ramirez Delgado](https://www.linkedin.com/in/yoandyrd92/).

![Python](https://img.shields.io/badge/Python-3.11%2B-blue)
![PySide6](https://img.shields.io/badge/PySide6-6.7%2B-green)
![License](https://img.shields.io/badge/License-Propietaria-red)

## Características

- **Dashboard ejecutivo** con índice de riesgo, matriz de madurez, KPIs por marco y mapa de brechas.
- **Frameworks integrados:** NIST CSF 2.0, ISO 27001:2022, CIS Controls v8 y RGPD.
- **Evaluación CMM (L0–L5)** por control con drill-down y listado de hallazgos críticos.
- **Asistente IA** vía Ollama (local o cloud) para recomendaciones y resumen ejecutivo.
- **Informes PDF** con tablas de hallazgos, heatmap, remediación y análisis IA argumentado.
- **Temas visuales** configurables (glassmorphism, acento personalizable).
- **Perfil de usuario** con foto, datos de organización y enlaces profesionales.

## Requisitos

- Windows 10/11 (64 bits)
- Python 3.11 o superior
- [Ollama](https://ollama.com/) (opcional, para funciones de IA)

## Instalación rápida

```bash
git clone https://github.com/heindall92/Norvik_Gobernanza.git
cd Norvik_Gobernanza
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

En Windows también puedes usar `run.bat`.

## Compilar ejecutable

```bash
pip install pyinstaller
pyinstaller norvik.spec --noconfirm
```

El binario queda en `dist\Norvik\Norvik.exe`.

## Estructura del proyecto

```
Norvik_Gobernanza/
├── main.py              # Punto de entrada
├── norvik.spec          # Configuración PyInstaller
├── core/                # Lógica de negocio (SQLite, madurez, PDF, Ollama)
├── ui/                  # Ventana Qt + bridge QWebChannel
│   └── web/             # Dashboard HTML/CSS/JS
├── data/frameworks/     # Definiciones JSON de marcos
├── assets/              # Iconos y recursos estáticos
└── Logo.jpeg            # Identidad corporativa Norvik
```

## Configuración de IA (Ollama)

1. Abre **Configuración** en la app.
2. Elige proveedor **Local** (`http://localhost:11434`) o **Cloud** (API key en [ollama.com](https://ollama.com)).
3. Descarga un modelo local, por ejemplo: `ollama pull llama3.2`
4. Usa **Probar conexión** antes de generar análisis o chat.

## Datos y privacidad

- Las evaluaciones se guardan en SQLite en el directorio de datos de la aplicación del usuario.
- Las fotos de perfil se almacenan localmente (máx. 3 MB).
- La API key de Ollama Cloud se guarda en el **Credential Manager de Windows** (keyring), no en texto plano.
- Ollama local no envía datos fuera del equipo salvo que configures el proveedor cloud.
- Los **datos de demostración** son opt-in, se marcan con badge **DEMO** y no son válidos para auditoría.

## Licencia comercial

**Software propietario — todos los derechos reservados © 2026 Yoandy Ramirez Delgado.**

| Documento | Contenido |
|-----------|-----------|
| [LICENSE](LICENSE) | Términos legales de propiedad intelectual |
| [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md) | Modalidades de licencia, uso permitido y cómo contratar |

Este repositorio es visible con fines de **demostración y portfolio**. Ver o clonar el código **no otorga derecho de uso** en producción. Para licenciar Norvik (usuario único, organización, OEM o código bajo NDA), contacta:

- [LinkedIn — Yoandy Ramirez Delgado](https://www.linkedin.com/in/yoandyrd92/)
- [GitHub — heindall92](https://github.com/heindall92)

### Dependencias de terceros

| Componente | Licencia |
|------------|----------|
| PySide6 / Qt | LGPL / comercial Qt |
| ReportLab | BSD |
| Ollama SDK | MIT |
| keyring | MIT |
| GSAP (vendor) | [GreenSock Standard License](https://gsap.com/standard-license) |
| Three.js (assets) | MIT |

## Autor

**Yoandy Ramirez Delgado**

- GitHub: [@heindall92](https://github.com/heindall92)
- LinkedIn: [yoandyrd92](https://www.linkedin.com/in/yoandyrd92/)

## Repositorio

https://github.com/heindall92/Norvik_Gobernanza
