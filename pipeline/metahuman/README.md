# Pipeline MetaHuman → Inclui+ (Three.js, web e telemóvel)

Este guia transforma um **MetaHuman** (Epic Games) num avatar leve para a Inclui+. O resultado é um `.glb` com:
- corpo completo com dedos;
- 52 expressões faciais ARKit;
- texturas reduzidas.

O avatar padrão **continua a ser usado** até o modelo realista passar no verificador e estar no catálogo.

## 1. O que foi verificado

| Questão | Resposta |
|---|---|
| Posso usar MetaHumans fora do Unreal? | **Sim**, desde a atualização de licença de junho de 2025. É permitido usá-los noutros motores e aplicações, incluindo projetos comerciais. Gratuito abaixo de 1 milhão de dólares de receita anual; acima disso, licença de lugar do Unreal. **Proibido:** usar MetaHumans para treinar modelos de IA. |
| Onde se cria? | No **Unreal Engine 5.6/5.7** (o criador web antigo fecha a 5/11/2026). O editor usa serviços na nuvem da Epic (conta Epic). |
| O MetaHuman exporta-se diretamente para Three.js? | **Não.** Há quatro obstáculos, resolvidos por este pipeline. |
| Audio2Face funciona com isto? | **Sim.** O Audio2Face-3D produz os mesmos 52 pesos ARKit que o avatar convertido tem. |

### Os quatro obstáculos e como são resolvidos

1. **Rosto:**
   - **Problema:** o rosto é controlado pelo RigLogic (≈800 articulações + correções). O Three.js não executa o RigLogic.
   - **Solução:** usar a animação de mapeamento ARKit do MetaHuman (uma pose por fotograma). O Blender converte cada pose numa *shape key*. As articulações faciais são depois fundidas no osso `head`.
2. **Peso:**
   - **Problema:** um MetaHuman LOD0 tem centenas de milhares de triângulos e texturas de 4–8K.
   - **Solução:** escolher o nível de detalhe por dispositivo:
     - computador: cabeça LOD1, corpo LOD1, texturas de 2K;
     - telemóvel: cabeça LOD3, corpo LOD2, texturas de 1K.

     Depois, compressão meshopt e texturas WebP.
3. **Materiais:**
   - **Problema:** pele, olhos refrativos e oclusão são *shaders* do Unreal e não passam pelo FBX.
   - **Solução:** exportar as texturas, recriar materiais PBR simples e remover as malhas que só funcionam no Unreal (oclusão dos olhos, fluido lacrimal, cartilagem).
4. **Cabelo:**
   - **Problema:** o cabelo em fios (*groom*) não existe em glTF.
   - **Solução:** usar a variante de cabelo em cartões (*cards*) do MetaHuman.

## 2. Passo a passo

### A. Unreal Engine 5.6+ (uma vez por personagem)
1. Crie o MetaHuman: rosto, **tom de pele (incluindo pele negra)**, idade, corpo, cabelo, roupa (bata, fato…).
2. Monte-o (*Assemble*) para Unreal.
3. Ative os plugins **Python Editor Script Plugin** e **MetaHuman**.
4. Edite `MH_NAME` e `OUT_DIR` em `ue/export_metahuman.py`.
5. Execute o script: `Tools → Execute Python Script…`. Exporta `body.fbx`, `face.fbx`, `part_*.fbx`, `arkit_poses.fbx`, `arkit_names.json` e `textures/`.

### B. Blender 4.2+ (sem abrir a interface)
```
blender -b -P blender/metahuman_to_web.py -- --in C:/IncluiExport/Amina --out amina_desktop.glb --tier desktop
blender -b -P blender/metahuman_to_web.py -- --in C:/IncluiExport/Amina --out amina_mobile.glb  --tier mobile
```
Cada execução escreve também `*_relatorio.json` com:
- triângulos, expressões, texturas e tamanho;
- uma **verificação das expressões**: a zona do rosto que `jawOpen`, `eyeBlinkLeft`… movem, para detetar uma ordem de nomes errada.

### C. Compressão
`./optimize.sh amina_desktop.glb amina_mobile.glb` (Windows: `optimize.bat`). Requer o executável `gltfpack` (meshoptimizer). Copia o resultado para `assets/avatars/metahuman/`.

### D. Verificação e ativação
1. Abra `tools/avatar-check.html` com a aplicação a correr (`npm start`). O verificador mostra:
   - tamanho, triângulos e texturas;
   - os ossos dos dedos;
   - as 52 expressões;
   - as letras A, L, V, O e B feitas pelo modelo;
   - sorriso, boca aberta, piscar e pergunta;
   - uma estimativa de fps.
2. Acrescente o modelo a `assets/avatars/avatars.json` e corra `npm run build`:
   ```json
   { "id": "mh-amina", "kind": "metahuman", "gender": "f", "label": "Amina — realista (MetaHuman)",
     "files": { "desktop": "metahuman/amina_desktop.glb", "mobile": "metahuman/amina_mobile.glb" },
     "tint": false, "license": "MetaHuman — EULA Unreal Engine" }
   ```
3. O modelo aparece no **Estúdio do avatar → Modelo 3D → "realista (MetaHuman)"**. A aplicação escolhe sozinha o ficheiro de telemóvel ou de computador.
4. Se o modelo falhar a carregar, a aplicação volta ao avatar padrão automaticamente.

## 3. Metas de desempenho

| | Computador | Telemóvel |
|---|---|---|
| Ficheiro | ≤ 30 MB | **≤ 15 MB** |
| Triângulos | ≤ 250 mil | **≤ 120 mil** |
| Texturas | 2048 px | **1024 px** |
| Expressões | 52 ARKit | 52 ARKit |

## 4. Rosto falado: Audio2Face-3D
- `server/a2f/a2f_service.py` usa o cliente oficial da NVIDIA (gRPC). Funciona de duas formas:
  - na nuvem NVIDIA, com uma chave grátis de build.nvidia.com;
  - num NIM local, com GPU NVIDIA.
- O fluxo é este:
  1. o servidor Node gera a voz com Piper (WAV);
  2. o Audio2Face devolve os 52 pesos ARKit por fotograma;
  3. a aplicação toca o áudio e aplica os pesos ao rosto, sincronizados com o tempo do áudio.
- Sem Audio2Face, a aplicação sincroniza os lábios palavra a palavra com a voz do navegador.

## 5. Limitações reais
- **Os scripts ainda não foram executados com um MetaHuman.** Foram escritos sobre as APIs documentadas do Unreal Python e do Blender. O ambiente onde a Inclui+ foi desenvolvida não tem Unreal Engine, Blender, conta Epic nem GPU. Espere afinações no primeiro personagem:
  - nomes das malhas e das texturas;
  - caminho da animação `mh_arkit_mapping_anim`;
  - ordem das 52 poses.
- As rugas dinâmicas, o *subsurface* da pele e os olhos refrativos do Unreal não existem em Three.js. O rosto fica realista, mas abaixo da qualidade de cinema do Unreal.
- O Audio2Face precisa de chave NVIDIA (nuvem) ou de GPU NVIDIA (local). A voz Piper corre no CPU do servidor.
- **Não incluímos nenhum ficheiro MetaHuman pronto.** Os MetaHumans criam-se com a conta Epic de quem os usa e não podem ser gerados aqui.
