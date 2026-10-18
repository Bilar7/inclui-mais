#!/usr/bin/env bash
# Inclui+ · comprime os avatares exportados pelo Blender (malha meshopt; texturas já em WebP)
# Requer gltfpack: https://github.com/zeux/meshoptimizer/releases (ficheiro único, sem instalação)
#   ./optimize.sh amina_desktop.glb amina_mobile.glb
set -euo pipefail
OUT="../../assets/avatars/metahuman"
mkdir -p "$OUT"
for f in "$@"; do
  name=$(basename "$f")
  # -cc  compressão de geometria e animação (EXT_meshopt_compression, já suportada pela Inclui+)
  # -kn  mantém os nomes dos nós (o esqueleto precisa deles)  · -km mantém materiais
  gltfpack -i "$f" -o "$OUT/$name" -cc -kn -km
  echo "✓ $name → $OUT/$name ($(du -h "$OUT/$name" | cut -f1))"
done
echo "Abra tools/avatar-check.html para verificar cada modelo antes de o ativar na aplicação."
