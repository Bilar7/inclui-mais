"""
Inclui+ · serviço Audio2Face-3D (NVIDIA)
Recebe um WAV (PCM 16 bits, mono) por HTTP e devolve a animação facial em pesos ARKit.

Baseado no cliente oficial da NVIDIA (Apache 2.0):
https://github.com/NVIDIA/Audio2Face-3D-Samples/tree/main/scripts/audio2face_3d_api_client

Dois modos:
  • Nuvem NVIDIA (NVCF):  A2F_API_KEY=nvapi-...  A2F_FUNCTION_ID=...   (chave grátis em build.nvidia.com)
  • NIM local (GPU NVIDIA): A2F_URI=localhost:52000

Instalação:
  python -m venv .venv && source .venv/bin/activate      (Windows: .venv\\Scripts\\activate)
  pip install -r requirements.txt
  pip install vendor/nvidia_ace-1.2.0-py3-none-any.whl
  python a2f_service.py          → http://127.0.0.1:8020/animate

Resposta JSON:  { "names": [52 nomes ARKit], "fps": 30, "frames": [[t, v0, v1, ...], ...] }
"""
import asyncio, io, json, os, wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import grpc, numpy, yaml
from nvidia_ace.a2f.v1_pb2 import AudioWithEmotion, EmotionPostProcessingParameters, FaceParameters, BlendShapeParameters
from nvidia_ace.audio.v1_pb2 import AudioHeader
from nvidia_ace.controller.v1_pb2 import AudioStream, AudioStreamHeader
from nvidia_ace.emotion_with_timecode.v1_pb2 import EmotionWithTimeCode
from nvidia_ace.services.a2f_controller.v1_pb2_grpc import A2FControllerServiceStub

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = yaml.safe_load(open(os.path.join(HERE, 'a2f_config.yml'), encoding='utf-8'))
PORT = int(os.environ.get('A2F_PORT', '8020'))


def channel():
    key, fid, uri = os.environ.get('A2F_API_KEY'), os.environ.get('A2F_FUNCTION_ID'), os.environ.get('A2F_URI')
    if key and fid:
        meta = [('function-id', fid), ('authorization', 'Bearer ' + key)]
        creds = grpc.composite_channel_credentials(grpc.ssl_channel_credentials(),
                                                   grpc.metadata_call_credentials(lambda ctx, cb: cb(meta, None)))
        return grpc.aio.secure_channel('grpc.nvcf.nvidia.com:443', creds)
    if uri:
        return grpc.aio.insecure_channel(uri)
    raise RuntimeError('Configure A2F_API_KEY + A2F_FUNCTION_ID (nuvem) ou A2F_URI (NIM local).')


def read_wav(data: bytes):
    with wave.open(io.BytesIO(data)) as w:
        if w.getsampwidth() != 2:
            raise ValueError('O áudio tem de ser PCM 16 bits.')
        rate, ch = w.getframerate(), w.getnchannels()
        pcm = numpy.frombuffer(w.readframes(w.getnframes()), dtype=numpy.int16)
        if ch > 1:
            pcm = pcm.reshape(-1, ch).mean(axis=1).astype(numpy.int16)  # Audio2Face só aceita mono
        return rate, pcm


async def animate(wav_bytes: bytes):
    rate, pcm = read_wav(wav_bytes)
    ch = channel()
    stream = A2FControllerServiceStub(ch).ProcessAudioStream()
    bs = CONFIG['blendshape_parameters']
    await stream.write(AudioStream(audio_stream_header=AudioStreamHeader(
        audio_header=AudioHeader(samples_per_second=rate, bits_per_sample=16, channel_count=1, audio_format=AudioHeader.AUDIO_FORMAT_PCM),
        emotion_post_processing_params=EmotionPostProcessingParameters(**CONFIG['post_processing_parameters']),
        face_params=FaceParameters(float_params=CONFIG['face_parameters']),
        blendshape_params=BlendShapeParameters(bs_weight_multipliers=bs['multipliers'], bs_weight_offsets=bs['offsets']))))
    emotions = [EmotionWithTimeCode(emotion={**v['emotions']}, time_code=v['time_code']) for v in CONFIG['emotion_with_timecode_list'].values()]
    for i in range(0, len(pcm), rate):
        chunk = pcm[i:i + rate].tobytes()
        msg = AudioWithEmotion(audio_buffer=chunk, emotions=emotions) if i == 0 else AudioWithEmotion(audio_buffer=chunk)
        await stream.write(AudioStream(audio_with_emotion=msg))
    await stream.write(AudioStream(end_of_audio=AudioStream.EndOfAudio()))

    names, frames, status = [], [], None
    while True:
        m = await stream.read()
        if m == grpc.aio.EOF:
            break
        if m.HasField('animation_data_stream_header'):
            names = list(m.animation_data_stream_header.skel_animation_header.blend_shapes)
        elif m.HasField('animation_data'):
            for b in m.animation_data.skel_animation.blend_shape_weights:
                frames.append([round(b.time_code, 4)] + [round(float(v), 4) for v in b.values])
        elif m.HasField('status'):
            status = m.status.message
    await ch.close()
    fps = round((len(frames) - 1) / (frames[-1][0] - frames[0][0])) if len(frames) > 2 else 30
    return {'names': names, 'fps': fps, 'frames': frames, 'status': status}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(code); self.send_header('content-type', 'application/json'); self.send_header('content-length', str(len(body)))
        self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        self._send(200, {'ok': True, 'service': 'audio2face'})

    def do_POST(self):
        if self.path != '/animate':
            return self._send(404, {'error': 'não encontrado'})
        n = int(self.headers.get('content-length', 0))
        if not n or n > 20_000_000:
            return self._send(400, {'error': 'Envie um WAV até 20 MB.'})
        try:
            self._send(200, asyncio.run(animate(self.rfile.read(n))))
        except Exception as e:  # mensagem clara para o servidor Node
            self._send(502, {'error': str(e)})


if __name__ == '__main__':
    print(f'Audio2Face-3D da Inclui+ em http://127.0.0.1:{PORT}/animate')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
