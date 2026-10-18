@echo off
REM Inclui+ · comprime os avatares exportados pelo Blender (Windows). Requer gltfpack.exe na mesma pasta ou no PATH.
REM   optimize.bat amina_desktop.glb amina_mobile.glb
set OUT=..\..\assets\avatars\metahuman
if not exist %OUT% mkdir %OUT%
for %%F in (%*) do (
  gltfpack -i "%%F" -o "%OUT%\%%~nxF" -cc -kn -km
  echo OK %%~nxF
)
echo Abra tools\avatar-check.html para verificar cada modelo.
