
# -*- mode: python ; coding: utf-8 -*-
import os
from pathlib import Path

# Find LiveKit resources
livekit_resources = []
try:
    import livekit.rtc
    livekit_path = Path(livekit.rtc.__file__).parent
    resources_path = livekit_path / 'resources'
    if resources_path.exists():
        for file in resources_path.rglob('*'):
            if file.is_file():
                rel_path = file.relative_to(livekit_path.parent)
                livekit_resources.append((str(file), str(Path('livekit') / rel_path.parent)))
except:
    pass

a = Analysis(
    ['src/ctsm/electron_main.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('src/ctsm/mcp', 'ctsm/mcp'),
        ('src/ctsm/*.py', 'ctsm'),
    ] + livekit_resources,
    hiddenimports=[
        'livekit.agents',
        'livekit.rtc',
        'livekit.rtc.resources',
        'livekit.plugins.openai',
        'livekit.plugins.deepgram',
        'livekit.plugins.cartesia',
        'livekit.plugins.silero',
        'livekit.plugins.noise_cancellation',
        'src.ctsm.mcp.agent_tools',
        'src.ctsm.mcp.context',
        'src.ctsm.mcp.util',
        'src.ctsm.models',
    ],
    hookspath=['.'],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ctsm-agent',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
