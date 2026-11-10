const express = require("express");
const axios = require("axios");
const sharp = require("sharp");
const FormData = require("form-data");
const ffmpeg = require("ffmpeg-static");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN) {
  console.error("TELEGRAM_BOT_TOKEN is missing!");
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;
const FILE_API = `https://api.telegram.org/file/bot${TOKEN}`;

let BOT_USERNAME = "";
const userModes = new Map();

async function telegram(method, data = {}) {
  const response = await axios.post(`${API}/${method}`, data);
  return response.data;
}

async function sendText(chatId, text, keyboard = null) {
  return telegram("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    ...(keyboard ? {
      reply_markup: { inline_keyboard: keyboard }
    } : {})
  });
}

async function sendFile(method, chatId, field, buffer, filename, contentType) {
  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append(field, buffer, {
    filename,
    contentType
  });

  const response = await axios.post(
    `${API}/${method}`,
    form,
    { headers: form.getHeaders(), maxBodyLength: Infinity }
  );

  return response.data;
}

async function downloadTelegramFile(fileId) {
  const result = await telegram("getFile", {
    file_id: fileId
  });

  const url = `${FILE_API}/${result.result.file_path}`;
  const response = await axios.get(url, {
    responseType: "arraybuffer"
  });

  return Buffer.from(response.data);
}

async function convertToSticker(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(512, 512, {
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 90 })
    .toBuffer();
}

async function convertToEmoji(buffer) {
  return sharp(buffer)
    .rotate()
    .resize(100, 100, {
      fit: "inside",
      withoutEnlargement: true
    })
    .webp({ quality: 90 })
    .toBuffer();
}

async function createStickerPack(userId, stickerBuffer, type) {
  const isEmoji = type === "custom_emoji";
  const fileName = "sticker.webp";

  const safeUsername = BOT_USERNAME.replace(/[^a-zA-Z0-9_]/g, "");

  const packName =
    `kalid_${userId}_${Date.now()}_by_${safeUsername}`;

  const title = isEmoji
    ? "Kalid Custom Emoji"
    : "Kalid Sticker Pack";

  const form = new FormData();

  form.append("user_id", String(userId));
  form.append("name", packName);
  form.append("title", title);
  form.append("sticker_type", isEmoji ? "custom_emoji" : "regular");

  form.append("stickers", JSON.stringify([
    {
      sticker: "attach://sticker_file",
      format: "static",
      emoji_list: [isEmoji ? "😀" : "❤️"]
    }
  ]));

  form.append("sticker_file", stickerBuffer, {
    filename: fileName,
    contentType: "image/webp"
  });

  const response = await axios.post(
    `${API}/createNewStickerSet`,
    form,
    {
      headers: form.getHeaders(),
      maxBodyLength: Infinity
    }
  );

  if (!response.data.ok) {
    throw new Error("Sticker pack creation failed.");
  }

  return `https://t.me/addstickers/${packName}`;
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const process = spawn(ffmpeg, args);

    let errorOutput = "";

    process.stderr.on("data", data => {
      errorOutput += data.toString();
    });

    process.on("error", reject);

    process.on("close", code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorOutput.slice(-1000)));
      }
    });
  });
}

async function createGIF(videoBuffer) {
  const input = path.join(os.tmpdir(), `kalid-${Date.now()}.mp4`);
  const output = path.join(os.tmpdir(), `kalid-${Date.now()}.gif`);

  try {
    fs.writeFileSync(input, videoBuffer);

    await runFFmpeg([
      "-y",
      "-i", input,
      "-t", "8",
      "-vf", "fps=12,scale=480:-1:flags=lanczos",
      "-loop", "0",
      output
    ]);

    return fs.readFileSync(output);
  } finally {
    if (fs.existsSync(input)) fs.unlinkSync(input);
    if (fs.existsSync(output)) fs.unlinkSync(output);
  }
}

async function createAnimatedSticker(videoBuffer) {
  const input = path.join(os.tmpdir(), `kalid-${Date.now()}.mp4`);
  const output = path.join(os.tmpdir(), `kalid-${Date.now()}.webm`);

  try {
    fs.writeFileSync(input, videoBuffer);

    await runFFmpeg([
      "-y",
      "-i", input,
      "-t", "3",
      "-vf",
      "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2,format=yuva420p",
      "-c:v", "libvpx-vp9",
      "-pix_fmt", "yuva420p",
      "-an",
      "-b:v", "400K",
      "-auto-alt-ref", "0",
      output
    ]);

    return fs.readFileSync(output);
  } finally {
    if (fs.existsSync(input)) fs.unlinkSync(input);
    if (fs.existsSync(output)) fs.unlinkSync(output);
  }
}

app.get("/", (req, res) => {
  res.send("KALID GIF & EMOJI STUDIO IS LIVE! 🚀");
});

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  try {
    const update = req.body;

    // BUTTONS
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const action = query.data;

      await telegram("answerCallbackQuery", {
        callback_query_id: query.id
      });

      const options = {
        emoji: "😀 Send me a photo to create your Emoji Pack.",
        sticker: "🥰 Send me a photo to create a Sticker.",
        gif: "🎬 Send me a video to convert it into a GIF.",
        animated: "🔥 Send me a short video for an Animated Sticker.",
        pack: "📦 Send me a photo to create your Sticker Pack.",
        help: "❓ Use /start to see all available features."
      };

      if (options[action]) {
        userModes.set(chatId, action);
        return sendText(chatId, options[action]);
      }
    }

    // MESSAGES
    if (!update.message) return;

    const message = update.message;
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || "";

    const command = text.split(" ")[0].split("@")[0];

    if (command === "/start") {
      userModes.delete(chatId);

      return sendText(
        chatId,
        "🎨 <b>WELCOME TO KALID GIF & EMOJI STUDIO!</b>\n\n" +
        "Create amazing GIFs, Emojis and Stickers! ❤️\n\n" +
        "Choose what you want to create:",
        [
          [
            { text: "😀 Emoji Maker", callback_data: "emoji" },
            { text: "🎬 GIF Maker", callback_data: "gif" }
          ],
          [
            { text: "🥰 Sticker Maker", callback_data: "sticker" },
            { text: "🔥 Animated Sticker", callback_data: "animated" }
          ],
          [
            { text: "📦 Sticker Pack", callback_data: "pack" }
          ],
          [
            { text: "❓ Help", callback_data: "help" }
          ]
        ]
      );
    }

    const commands = {
      "/emoji": "emoji",
      "/gif": "gif",
      "/sticker": "sticker",
      "/animated": "animated",
      "/pack": "pack"
    };

    if (commands[command]) {
      const mode = commands[command];
      userModes.set(chatId, mode);

      const prompts = {
        emoji: "😀 Send a photo to create your Custom Emoji Pack.",
        gif: "🎬 Send a video to create a GIF.",
        sticker: "🥰 Send a photo to create a Sticker.",
        animated: "🔥 Send a short video for an Animated Sticker.",
        pack: "📦 Send a photo to create a Sticker Pack."
      };

      return sendText(chatId, prompts[mode]);
    }

    if (command === "/help") {
      return sendText(
        chatId,
        "❓ <b>KALID HELP CENTER</b>\n\n" +
        "/start - Main menu\n" +
        "/emoji - Custom Emoji Pack\n" +
        "/gif - Video to GIF\n" +
        "/sticker - Photo to Sticker\n" +
        "/animated - Animated Sticker\n" +
        "/pack - Sticker Pack"
      );
    }

    const mode = userModes.get(chatId);

    // PHOTO PROCESSING
    if (message.photo) {
      if (!mode || !["emoji", "sticker", "pack"].includes(mode)) {
        return sendText(
          chatId,
          "Please choose Sticker, Emoji or Sticker Pack first using /start."
        );
      }

      await sendText(chatId, "⏳ Processing your photo... ❤️");

      const photo = message.photo[message.photo.length - 1];
      const original = await downloadTelegramFile(photo.file_id);

      if (mode === "sticker") {
        const sticker = await convertToSticker(original);

        await sendFile(
          "sendSticker",
          chatId,
          "sticker",
          sticker,
          "kalid-sticker.webp",
          "image/webp"
        );

        userModes.delete(chatId);

        return sendText(chatId, "✅ Your sticker is ready! ❤️");
      }

      if (mode === "emoji") {
        const emoji = await convertToEmoji(original);
        const link = await createStickerPack(
          userId,
          emoji,
          "custom_emoji"
        );

        userModes.delete(chatId);

        return sendText(
          chatId,
          `🎉 Your Custom Emoji Pack is ready!\n\n${link}`
        );
      }

      if (mode === "pack") {
        const sticker = await convertToSticker(original);
        const link = await createStickerPack(
          userId,
          sticker,
          "regular"
        );

        userModes.delete(chatId);

        return sendText(
          chatId,
          `🎉 Your Sticker Pack is ready!\n\n${link}`
        );
      }
    }

    // VIDEO PROCESSING
    if (message.video || message.animation) {
      if (!mode || !["gif", "animated"].includes(mode)) {
        return sendText(
          chatId,
          "Please choose GIF or Animated Sticker first using /start."
        );
      }

      await sendText(chatId, "⏳ Processing your video... 🎬");

      const videoId = message.video
        ? message.video.file_id
        : message.animation.file_id;

      const video = await downloadTelegramFile(videoId);

      if (mode === "gif") {
        const gif = await createGIF(video);

        await sendFile(
          "sendAnimation",
          chatId,
          "animation",
          gif,
          "kalid.gif",
          "image/gif"
        );

        userModes.delete(chatId);

        return sendText(chatId, "🎉 Your GIF is ready! ❤️");
      }

      if (mode === "animated") {
        const animated = await createAnimatedSticker(video);

        await sendFile(
          "sendSticker",
          chatId,
          "sticker",
          animated,
          "kalid.webm",
          "video/webm"
        );

        userModes.delete(chatId);

        return sendText(
          chatId,
          "🎉 Animated sticker created and sent!"
        );
      }
    }

    if (text) {
      return sendText(
        chatId,
        "👋 Please send /start to open the main menu."
      );
    }

  } catch (error) {
    console.error(
      "PROCESSING ERROR:",
      error.response?.data || error.message
    );

    const chatId = req.body?.message?.chat?.id;

    if (chatId) {
      await sendText(
        chatId,
        "❌ Something went wrong while processing. Please try again."
      ).catch(() => {});
    }
  }
});

// START SERVER
app.listen(PORT, async () => {
  console.log(`KALID GIF & EMOJI STUDIO running on port ${PORT}`);

  try {
    console.log("Checking Telegram bot token...");

    const bot = await telegram("getMe");
    BOT_USERNAME = bot.result.username;

    console.log("TELEGRAM BOT CONNECTED:", BOT_USERNAME);

    if (!BASE_URL) {
      throw new Error("RENDER_EXTERNAL_URL is missing!");
    }

    const webhookURL =
      `${BASE_URL.replace(/\/+$/, "")}/webhook`;

    const result = await telegram("setWebhook", {
      url: webhookURL,
      allowed_updates: ["message", "callback_query"]
    });

    console.log("WEBHOOK RESULT:", result);

  } catch (error) {
    console.error(
      "STARTUP ERROR:",
      error.response?.data || error.message
    );
  }
});