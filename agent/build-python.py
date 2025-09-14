#!/usr/bin/env python3
"""Build script to create Python executable using PyInstaller."""

import os
import shutil
import subprocess
import sys
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a shell command and handle errors."""
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)

    if result.returncode != 0:
        print(f"Error running command: {' '.join(cmd)}")
        print(f"STDOUT: {result.stdout}")
        print(f"STDERR: {result.stderr}")
        sys.exit(1)

    return result

def main():
    """Main build function."""
    # Get the directory this script is in
    script_dir = Path(__file__).parent
    os.chdir(script_dir)

    print("Building Python executable for CTSM Voice Assistant...")

    # Clean previous builds
    build_dirs = ['build', 'dist', 'python-dist']
    for build_dir in build_dirs:
        if Path(build_dir).exists():
            print(f"Cleaning {build_dir}/")
            shutil.rmtree(build_dir)

    # Install PyInstaller if not available
    try:
        run_command(['uv', 'add', 'pyinstaller'])
    except:
        print("Failed to add PyInstaller. Make sure uv is installed.")
        sys.exit(1)

    # Create PyInstaller spec file
    spec_content = '''
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
'''

    with open('ctsm.spec', 'w') as f:
        f.write(spec_content)

    # Run PyInstaller
    print("Running PyInstaller...")
    run_command(['uv', 'run', 'pyinstaller', 'ctsm.spec', '--clean'])

    # Create python-dist directory for Electron
    python_dist = Path('python-dist')
    python_dist.mkdir(exist_ok=True)

    # Copy the executable
    exe_name = 'ctsm-agent.exe' if sys.platform == 'win32' else 'ctsm-agent'
    exe_path = Path('dist') / exe_name

    if exe_path.exists():
        shutil.copy2(exe_path, python_dist / exe_name)
        print(f"✅ Python executable created: {python_dist / exe_name}")
    else:
        print("❌ Failed to create Python executable")
        sys.exit(1)

    print("🎉 Python build completed successfully!")

if __name__ == '__main__':
    main()