const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { spawn } = require('child_process');
const vosk = require('vosk');

// Путь к модели Vosk
const MODEL_PATH = path.join(__dirname, 'model');

if (!fs.existsSync(MODEL_PATH)) {
  console.error('Модель не найдена по пути:', MODEL_PATH);
  process.exit(1);
}

// Инициализируем модель (стандартная логика из примеров Vosk)
vosk.setLogLevel(0); // 0 — без логов, можно изменить при отладке
const model = new vosk.Model(MODEL_PATH);

// Настройки аудио: 16 kHz, моно
const SAMPLE_RATE = 16000;

const app = express();

// Настройка multer для загрузки файла в память
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

// Утилита: проверка/конвертация аудио в нужный формат через ffmpeg
function convertToRawPcm(buffer) {
  return new Promise((resolve, reject) => {
    // ffmpeg должен быть установлен в системе и доступен в PATH
    const ffmpeg = spawn('ffmpeg', [
      '-i',
      'pipe:0',          // читаем из stdin
      '-acodec',
      'pcm_s16le',       // 16-bit signed little-endian
      '-ac',
      '1',               // mono
      '-ar',
      String(SAMPLE_RATE), // 16kHz
      '-f',
      's16le',
      'pipe:1',          // пишем в stdout
    ]);

    const chunks = [];
    let errorData = '';

    ffmpeg.stdout.on('data', (data) => {
      chunks.push(data);
    });

    ffmpeg.stderr.on('data', (data) => {
      errorData += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffmpeg exited with code ${code}: ${errorData}`));
      }
      resolve(Buffer.concat(chunks));
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });

    // Пишем исходный буфер в stdin ffmpeg
    ffmpeg.stdin.write(buffer);
    ffmpeg.stdin.end();
  });
}

// POST /transcribe — принимает аудиофайл и возвращает распознанный текст
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Не передан файл. Используйте поле "audio".' });
    }

    // Конвертируем (или просто приводим) файл к raw PCM 16kHz mono
    const pcmBuffer = await convertToRawPcm(req.file.buffer);

    // Создаем поток для передачи буфера в распознаватель
    const audioStream = new Readable();
    audioStream._read = () => {};
    audioStream.push(pcmBuffer);
    audioStream.push(null);

    const rec = new vosk.Recognizer({ model, sampleRate: SAMPLE_RATE });

    audioStream.on('data', (data) => {
      rec.acceptWaveform(data);
    });

    audioStream.on('end', () => {
      const result = rec.finalResult();
      rec.free();

      // result имеет вид { text: "...", ... }
      return res.json({
        text: result.text || '',
        rawResult: result,
      });
    });

    audioStream.on('error', (err) => {
      rec.free();
      console.error(err);
      return res.status(500).json({ error: 'Ошибка при чтении аудио потока', details: err.message });
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Ошибка при распознавании', details: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Vosk server listening on port ${PORT}`);
});