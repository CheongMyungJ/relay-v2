# Windows command hooks. Paths come from the app environment, never from shell code.
$ErrorActionPreference = 'Stop'
$env:ELECTRON_RUN_AS_NODE = '1'
$utf8 = [Text.UTF8Encoding]::new($false)
[Console]::InputEncoding = $utf8
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
# Electron is a GUI-subsystem executable on Windows. A pipeline makes PowerShell
# wait for it instead of returning before the HTTP hook response is ready.
& $env:RELAY_CODEX_EXE $env:RELAY_CODEX_BRIDGE hook | ForEach-Object { [Console]::WriteLine($_) }
exit $LASTEXITCODE
