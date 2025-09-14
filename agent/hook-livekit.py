from PyInstaller.utils.hooks import collect_data_files, collect_submodules

# Collect all livekit data files and submodules
datas = collect_data_files('livekit')
hiddenimports = collect_submodules('livekit')

# Specifically ensure livekit.rtc.resources is included
hiddenimports.extend(['livekit.rtc.resources'])

# Try to find and include livekit native libraries
try:
    import livekit.rtc
    from pathlib import Path
    livekit_path = Path(livekit.rtc.__file__).parent
    resources_path = livekit_path / 'resources'
    if resources_path.exists():
        for file in resources_path.rglob('*'):
            if file.is_file():
                rel_path = file.relative_to(livekit_path.parent)
                datas.append((str(file), str(Path('livekit') / rel_path.parent)))
except ImportError:
    pass