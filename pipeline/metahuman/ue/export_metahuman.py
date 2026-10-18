"""
Inclui+ · Exportar um MetaHuman do Unreal Engine 5.6/5.7 para preparação web
------------------------------------------------------------------------------
Como usar (dentro do Unreal Editor):
  1. Ative os plugins "Python Editor Script Plugin" e "MetaHuman" e reinicie o editor.
  2. Abra o projeto onde está o MetaHuman (montado/"assembled" para Unreal).
  3. Edite as três linhas de CONFIGURAÇÃO abaixo.
  4. Menu  Tools → Execute Python Script…  e escolha este ficheiro.

O que exporta para OUT_DIR:
  body.fbx            corpo + roupa (todas as LOD) com o esqueleto completo, incluindo os dedos
  face.fbx            cabeça, olhos, dentes, pestanas (todas as LOD) com o esqueleto facial
  arkit_poses.fbx     animação com uma pose ARKit por fotograma (usada para gerar as 52 expressões)
  arkit_names.json    ordem das poses na animação
  textures/*.tga      texturas usadas pelo personagem (cor, normal, rugosidade, cabelo em cartões)
  manifest.json       lista do que foi exportado

Notas reais:
  • O esqueleto facial do MetaHuman é controlado pelo RigLogic (centenas de articulações). Three.js não
    executa o RigLogic; por isso as expressões são convertidas em 52 "blendshapes" ARKit no Blender.
  • O cabelo em fios ("groom") não existe em glTF. Use a variante de cabelo em cartões ("cards") do MetaHuman.
  • Os materiais do Unreal (pele com subsurface, olhos refrativos) não passam pelo FBX: exportam-se as texturas
    e o Blender reconstrói materiais PBR simples.
"""
import json
import os
import unreal

# ---------------- CONFIGURAÇÃO ----------------
MH_NAME = "Amina"                                   # pasta do personagem em /Game/MetaHumans/
OUT_DIR = "C:/IncluiExport/Amina"                  # pasta de saída (será criada)
SEARCH_ROOTS = ["/Game/MetaHumans"]                 # onde procurar os recursos do MetaHuman
# ----------------------------------------------

reg = unreal.AssetRegistryHelpers.get_asset_registry()
os.makedirs(os.path.join(OUT_DIR, "textures"), exist_ok=True)
log = {"character": MH_NAME, "exported": [], "warnings": []}


def assets_of(cls_name, contains=None, roots=SEARCH_ROOTS):
    out = []
    for root in roots:
        for a in reg.get_assets_by_path(root, recursive=True):
            if str(a.asset_class_path.asset_name) != cls_name:
                continue
            path = str(a.package_name)
            if contains and contains.lower() not in path.lower():
                continue
            out.append(a.get_asset())
    return out


def dependencies(package_name, depth=3):
    """Recursos de que o Blueprint do personagem depende (malhas, texturas, materiais)."""
    seen, frontier = set(), [package_name]
    opts = unreal.AssetRegistryDependencyOptions(include_soft_package_references=True, include_hard_package_references=True)
    for _ in range(depth):
        nxt = []
        for p in frontier:
            for d in reg.get_dependencies(p, opts) or []:
                d = str(d)
                if d.startswith("/Game") and d not in seen:
                    seen.add(d); nxt.append(d)
        frontier = nxt
    return seen


def fbx_options(lods=True, preview_mesh=False):
    o = unreal.FbxExportOption()
    o.level_of_detail = lods
    o.export_morph_targets = True
    o.collision = False
    o.vertex_color = False
    o.export_preview_mesh = preview_mesh
    o.fbx_export_compatibility = unreal.FbxExportCompatibility.FBX_2020
    return o


def export(obj, filename, options=None):
    task = unreal.AssetExportTask()
    task.object = obj
    task.filename = os.path.join(OUT_DIR, filename)
    task.automated = True
    task.prompt = False
    task.replace_identical = True
    if options is not None:
        task.options = options
    ok = unreal.Exporter.run_asset_export_task(task)
    (log["exported"] if ok else log["warnings"]).append(filename if ok else "falhou: " + filename)
    unreal.log(("OK " if ok else "FALHOU ") + task.filename)
    return ok


# 1) Blueprint do personagem e as suas dependências
bps = [a for a in assets_of("Blueprint", "/" + MH_NAME + "/") if a.get_name().startswith("BP_")]
if not bps:
    raise RuntimeError(f"Não encontrei BP_{MH_NAME} em {SEARCH_ROOTS}. Confirme MH_NAME e se o MetaHuman foi montado para Unreal.")
deps = dependencies(bps[0].get_outermost().get_name())
dep_assets = [unreal.EditorAssetLibrary.load_asset(d) for d in deps]

# 2) malhas: cabeça ("Face") e corpo ("Body"), mais roupa e cabelo em cartões
meshes = [a for a in dep_assets if isinstance(a, unreal.SkeletalMesh)]
face = [m for m in meshes if "face" in m.get_name().lower()]
body = [m for m in meshes if "body" in m.get_name().lower()]
others = [m for m in meshes if m not in face and m not in body]
if not face or not body:
    log["warnings"].append("Não identifiquei claramente as malhas Face/Body; confirme os nomes em manifest.json")
if face: export(face[0], "face.fbx", fbx_options(lods=True))
if body: export(body[0], "body.fbx", fbx_options(lods=True))
for i, m in enumerate(others):                         # roupa, cabelo em cartões, sobrancelhas…
    export(m, f"part_{i:02d}_{m.get_name()}.fbx", fbx_options(lods=True))

# 3) animação de mapeamento ARKit (uma pose por fotograma)
anims = [a for a in assets_of("AnimSequence") if "arkit" in a.get_name().lower() and "mapping" in a.get_name().lower()]
names = []
if anims:
    export(anims[0], "arkit_poses.fbx", fbx_options(lods=False, preview_mesh=False))
    poses = [a for a in assets_of("PoseAsset") if "arkit" in a.get_name().lower() and "mapping" in a.get_name().lower()]
    if poses:
        try:
            names = [str(n) for n in poses[0].get_pose_names()]
        except Exception as e:                           # a função pode não estar exposta em todas as versões
            log["warnings"].append(f"Sem nomes das poses ({e}); o Blender usa a ordem ARKit padrão e verifica-a.")
else:
    log["warnings"].append("Não encontrei a animação 'mh_arkit_mapping_anim'. Ver README, secção 'Expressões'.")
json.dump(names, open(os.path.join(OUT_DIR, "arkit_names.json"), "w"), indent=1)

# 4) texturas usadas pelos materiais do personagem
for t in [a for a in dep_assets if isinstance(a, unreal.Texture2D)]:
    export(t, os.path.join("textures", t.get_name() + ".tga"))

json.dump(log, open(os.path.join(OUT_DIR, "manifest.json"), "w"), indent=1)
unreal.log(f"Inclui+: exportação terminada em {OUT_DIR}. Avisos: {len(log['warnings'])}")
