"""
Inclui+ · Converter um MetaHuman exportado do Unreal num avatar web leve (glTF/GLB) para Three.js
--------------------------------------------------------------------------------------------------
Blender 4.2 ou superior. Corre sem abrir a interface:

  blender -b -P metahuman_to_web.py -- --in C:/IncluiExport/Amina --out amina_desktop.glb --tier desktop
  blender -b -P metahuman_to_web.py -- --in C:/IncluiExport/Amina --out amina_mobile.glb  --tier mobile

O que faz:
  1. Importa body.fbx, face.fbx, part_*.fbx (roupa, cabelo em cartões) e arkit_poses.fbx.
  2. Escolhe o nível de detalhe (LOD) certo para computador ou telemóvel e apaga os restantes.
  3. Converte as poses ARKit do rig facial em 52 blendshapes (shape keys) em todas as malhas da cabeça.
  4. Junta a cabeça ao esqueleto do corpo: os pesos das ~800 articulações faciais passam para "head"
     (as expressões passam a viver nas shape keys, que o Three.js anima diretamente).
  5. Acrescenta ossos de ponta aos dedos (para o cálculo do polegar e do reconhecimento de letras).
  6. Remove peças que só funcionam no Unreal (oclusão dos olhos, fluido lacrimal, cartilagem).
  7. Recria materiais PBR simples com as texturas exportadas e reduz as texturas (2K / 1K).
  8. Exporta GLB (pele, esqueleto, 52 expressões, sem animações) e escreve um relatório JSON.
Depois: comprimir com  gltfpack -i saida.glb -o final.glb -cc   (ver optimize.sh).
"""
import bpy, bmesh, json, os, re, sys, glob
from mathutils import Vector

ARKIT = ['eyeBlinkLeft', 'eyeLookDownLeft', 'eyeLookInLeft', 'eyeLookOutLeft', 'eyeLookUpLeft', 'eyeSquintLeft', 'eyeWideLeft',
         'eyeBlinkRight', 'eyeLookDownRight', 'eyeLookInRight', 'eyeLookOutRight', 'eyeLookUpRight', 'eyeSquintRight', 'eyeWideRight',
         'jawForward', 'jawLeft', 'jawRight', 'jawOpen', 'mouthClose', 'mouthFunnel', 'mouthPucker', 'mouthLeft', 'mouthRight',
         'mouthSmileLeft', 'mouthSmileRight', 'mouthFrownLeft', 'mouthFrownRight', 'mouthDimpleLeft', 'mouthDimpleRight',
         'mouthStretchLeft', 'mouthStretchRight', 'mouthRollLower', 'mouthRollUpper', 'mouthShrugLower', 'mouthShrugUpper',
         'mouthPressLeft', 'mouthPressRight', 'mouthLowerDownLeft', 'mouthLowerDownRight', 'mouthUpperUpLeft', 'mouthUpperUpRight',
         'browDownLeft', 'browDownRight', 'browInnerUp', 'browOuterUpLeft', 'browOuterUpRight', 'cheekPuff', 'cheekSquintLeft',
         'cheekSquintRight', 'noseSneerLeft', 'noseSneerRight', 'tongueOut']

# Nível de detalhe por dispositivo (cabeça, corpo) e tamanho máximo das texturas
TIERS = {'desktop': {'face_lod': 1, 'body_lod': 1, 'tex': 2048}, 'mobile': {'face_lod': 3, 'body_lod': 2, 'tex': 1024}}
DROP_MATERIALS = re.compile(r'occlusion|lacrimal|cartilage|eyeshell|eyeedge|eyelashhigher', re.I)
KEEP_BODY_BONES = None  # preenchido com os ossos do esqueleto do corpo


def args():
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    o = {'in': None, 'out': 'avatar.glb', 'tier': 'desktop'}
    for i in range(0, len(a) - 1, 2):
        o[a[i].lstrip('-')] = a[i + 1]
    if not o['in']:
        raise SystemExit('Indique --in <pasta exportada do Unreal>')
    return o


def import_fbx(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False, ignore_leaf_bones=False, use_anim=True)
    return [o for o in bpy.data.objects if o not in before]


def lod_of(name):
    m = re.search(r'LOD(\d+)', name, re.I)
    return int(m.group(1)) if m else 0


def keep_lod(objs, lod):
    """Mantém só um LOD (o mais próximo disponível)."""
    meshes = [o for o in objs if o.type == 'MESH']
    lods = sorted({lod_of(o.name) for o in meshes})
    if not lods:
        return meshes
    chosen = min(lods, key=lambda l: abs(l - lod))
    keep = []
    for o in meshes:
        if lod_of(o.name) == chosen:
            keep.append(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
    return keep


def drop_unreal_only_parts(meshes):
    """Apaga faces cujos materiais só fazem sentido no Unreal (efeitos de olhos, oclusão)."""
    for o in list(meshes):
        idx = [i for i, s in enumerate(o.material_slots) if s.material and DROP_MATERIALS.search(s.material.name)]
        if not idx:
            continue
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in idx], context='FACES')
        bm.to_mesh(o.data); bm.free()
        if len(o.data.polygons) == 0:
            meshes.remove(o); bpy.data.objects.remove(o, do_unlink=True)


def bake_arkit(face_arm, face_meshes, pose_action, names, report):
    """Para cada fotograma da animação de mapeamento, guarda a forma deformada como shape key ARKit."""
    face_arm.animation_data_create()
    face_arm.animation_data.action = None
    dg = bpy.context.evaluated_depsgraph_get()
    for o in face_meshes:
        if not o.data.shape_keys:
            o.shape_key_add(name='Basis', from_mix=False)
    start, end = [int(v) for v in pose_action.frame_range]
    n = end - start + 1
    offset = 1 if n == len(names) + 1 else 0          # alguns mapeamentos têm uma pose neutra no início
    face_arm.animation_data.action = pose_action
    scn = bpy.context.scene
    for k, name in enumerate(names):
        scn.frame_set(start + offset + k)
        dg.update()
        for o in face_meshes:
            ev = o.evaluated_get(dg).to_mesh()
            if len(ev.vertices) != len(o.data.vertices):
                o.evaluated_get(dg).to_mesh_clear(); continue
            sk = o.shape_key_add(name=name, from_mix=False)
            for i, v in enumerate(ev.vertices):
                sk.data[i].co = v.co
            o.evaluated_get(dg).to_mesh_clear()
    face_arm.animation_data.action = None
    scn.frame_set(start)
    # verificação: zona do rosto que cada expressão move (deteta ordem errada de nomes)
    head = max(face_meshes, key=lambda o: len(o.data.vertices))
    base = [v.co.copy() for v in head.data.shape_keys.key_blocks['Basis'].data]
    checks = {}
    for name in ('jawOpen', 'eyeBlinkLeft', 'eyeBlinkRight', 'browInnerUp', 'mouthSmileLeft'):
        kb = head.data.shape_keys.key_blocks.get(name)
        if not kb:
            continue
        moved = [(kb.data[i].co - base[i]).length for i in range(len(base))]
        mx = max(moved) or 1
        c = sum((base[i] for i in range(len(base)) if moved[i] > mx * 0.5), Vector()) / max(1, sum(1 for m in moved if m > mx * 0.5))
        checks[name] = {'max_mm': round(mx * 10, 2), 'centro': [round(v, 2) for v in c]}
    report['verificacao_expressoes'] = checks


def merge_face_into_body(face_arm, body_arm, face_meshes):
    """As articulações faciais deixam de ser precisas: os pesos passam para 'head' do corpo."""
    body_bones = {b.name for b in body_arm.data.bones}
    for o in face_meshes:
        head = o.vertex_groups.get('head') or o.vertex_groups.new(name='head')
        extra = [g for g in o.vertex_groups if g.name not in body_bones]
        for v in o.data.vertices:
            w = sum(g.weight for g in v.groups if o.vertex_groups[g.group] in extra)
            if w > 0:
                head.add([v.index], min(1.0, w + sum(g.weight for g in v.groups if o.vertex_groups[g.group] == head)), 'REPLACE')
        for g in extra:
            o.vertex_groups.remove(g)
        for m in o.modifiers:
            if m.type == 'ARMATURE':
                m.object = body_arm
        o.parent = body_arm
    bpy.data.objects.remove(face_arm, do_unlink=True)


def add_finger_tips(arm):
    """Cria index_04_l, …, thumb_04_r na ponta de cada dedo (comprimento igual ao osso anterior)."""
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    for side in ('l', 'r'):
        for f in ('thumb', 'index', 'middle', 'ring', 'pinky'):
            last = eb.get(f'{f}_03_{side}')
            if not last or eb.get(f'{f}_04_{side}'):
                continue
            tip = eb.new(f'{f}_04_{side}')
            d = last.tail - last.head
            tip.head = last.tail; tip.tail = last.tail + d * 0.6; tip.roll = last.roll; tip.parent = last
    bpy.ops.object.mode_set(mode='OBJECT')


def rebuild_materials(meshes, tex_dir, max_size, report):
    files = glob.glob(os.path.join(tex_dir, '*.*'))
    def find(*words):
        for f in files:
            n = os.path.basename(f).lower()
            if all(w in n for w in words):
                return f
        return None
    used = []
    for o in meshes:
        for slot in o.material_slots:
            mat = slot.material
            if not mat:
                continue
            key = mat.name.lower()
            part = 'head' if 'head' in key or 'face' in key else 'body' if 'body' in key else 'teeth' if 'teeth' in key else 'eye' if 'eye' in key and 'lash' not in key else 'lash' if 'lash' in key else 'hair' if 'hair' in key else re.sub(r'^mi?_', '', key).split('_')[0]
            bc = find(part, 'basecolor') or find(part, 'albedo') or find(part, 'diffuse') or find(part, '_bc')
            nm = find(part, 'normal') or find(part, '_n.')
            rg = find(part, 'rough') or find(part, 'specular')
            mat.use_nodes = True
            nt = mat.node_tree; nt.nodes.clear()
            out = nt.nodes.new('ShaderNodeOutputMaterial'); bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
            nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
            bsdf.inputs['Roughness'].default_value = 0.55 if part in ('head', 'body') else 0.4
            if part in ('head', 'body'):
                # pele: um pouco de subsurface dá um aspeto mais humano (convertido pelo exportador glTF quando suportado)
                if 'Subsurface Weight' in bsdf.inputs: bsdf.inputs['Subsurface Weight'].default_value = 0.08
            def tex(path, color=True):
                img = bpy.data.images.load(path, check_existing=True)
                if max(img.size) > max_size:
                    s = max_size / max(img.size); img.scale(int(img.size[0] * s), int(img.size[1] * s))
                img.colorspace_settings.name = 'sRGB' if color else 'Non-Color'
                node = nt.nodes.new('ShaderNodeTexImage'); node.image = img; used.append(os.path.basename(path)); return node
            if bc:
                t = tex(bc); nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
                if part in ('lash', 'hair'):
                    nt.links.new(t.outputs['Alpha'], bsdf.inputs['Alpha']); mat.blend_method = 'HASHED' if hasattr(mat, 'blend_method') else None
            if nm:
                t = tex(nm, False); n = nt.nodes.new('ShaderNodeNormalMap')
                nt.links.new(t.outputs['Color'], n.inputs['Color']); nt.links.new(n.outputs['Normal'], bsdf.inputs['Normal'])
            if rg:
                t = tex(rg, False); nt.links.new(t.outputs['Color'], bsdf.inputs['Roughness'])
    report['texturas'] = sorted(set(used))


def main():
    a = args(); tier = TIERS[a['tier']]; src = a['in']; report = {'tier': a['tier'], 'avisos': []}
    bpy.ops.wm.read_factory_settings(use_empty=True)
    body_objs = import_fbx(os.path.join(src, 'body.fbx'))
    body_arm = next(o for o in body_objs if o.type == 'ARMATURE')
    body_meshes = keep_lod(body_objs, tier['body_lod'])
    face_objs = import_fbx(os.path.join(src, 'face.fbx'))
    face_arm = next(o for o in face_objs if o.type == 'ARMATURE')
    face_meshes = keep_lod(face_objs, tier['face_lod'])
    drop_unreal_only_parts(face_meshes)
    for p in sorted(glob.glob(os.path.join(src, 'part_*.fbx'))):
        objs = import_fbx(p)
        arm = next((o for o in objs if o.type == 'ARMATURE'), None)
        meshes = keep_lod(objs, tier['body_lod'])
        for m in meshes:
            for mod in m.modifiers:
                if mod.type == 'ARMATURE': mod.object = body_arm
            m.parent = body_arm; body_meshes.append(m)
        if arm: bpy.data.objects.remove(arm, do_unlink=True)

    names_file = os.path.join(src, 'arkit_names.json')
    names = json.load(open(names_file)) if os.path.exists(names_file) else []
    names = names if len(names) >= 50 else ARKIT
    if os.path.exists(os.path.join(src, 'arkit_poses.fbx')):
        anim_objs = import_fbx(os.path.join(src, 'arkit_poses.fbx'))
        anim_arm = next(o for o in anim_objs if o.type == 'ARMATURE')
        action = anim_arm.animation_data.action if anim_arm.animation_data else None
        for o in anim_objs: bpy.data.objects.remove(o, do_unlink=True)
        if action: bake_arkit(face_arm, face_meshes, action, names, report)
        else: report['avisos'].append('arkit_poses.fbx sem animação: o avatar fica sem expressões faciais')
    else:
        report['avisos'].append('Sem arkit_poses.fbx: o avatar fica sem expressões faciais')

    merge_face_into_body(face_arm, body_arm, face_meshes)
    add_finger_tips(body_arm)
    all_meshes = body_meshes + face_meshes
    rebuild_materials(all_meshes, os.path.join(src, 'textures'), tier['tex'], report)
    for o in bpy.data.objects:
        if o.type == 'MESH' and o not in all_meshes:
            bpy.data.objects.remove(o, do_unlink=True)

    report['triangulos'] = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in all_meshes)
    report['malhas'] = [o.name for o in all_meshes]
    report['expressoes'] = len(face_meshes[0].data.shape_keys.key_blocks) - 1 if face_meshes and face_meshes[0].data.shape_keys else 0
    opts = dict(filepath=a['out'], export_format='GLB', export_animations=False, export_skins=True, export_morph=True,
                export_morph_normal=False, export_yup=True, export_apply=False, export_image_format='WEBP')  # WebP: leve e com transparência
    q = 86 if a['tier'] == 'desktop' else 78
    try: bpy.ops.export_scene.gltf(**opts, export_image_quality=q)
    except TypeError: bpy.ops.export_scene.gltf(**opts, export_jpeg_quality=q)
    report['ficheiro_mb'] = round(os.path.getsize(a['out']) / 1e6, 2)
    json.dump(report, open(os.path.splitext(a['out'])[0] + '_relatorio.json', 'w'), indent=1, ensure_ascii=False)
    print('Inclui+: GLB criado', a['out'], report)


main()
