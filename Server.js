const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = `https://api.telegram.org/bot${TOKEN}`;

async function sendMessage(chatId, text, keyboard = null) {
  try {
    await axios.post(`${API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard
        ? { inline_keyboard: keyboard }
        : undefined
    });
  } catch (error) {
    console.error("Telegram error:", error.response?.data || error.message);
  }
}

app.get("/", (req, res) => {
  res.send("KALID GIF & EMOJI STUDIO is running! 🚀");
});

app.post("/webhook", async (req, res) => {
  res.sendStatus(200);

  const update = req.body;

  if (update.message) {
    const message = update.message;
    const chatId = message.chat.id;
    const text = message.text || "";

    if (text === "/start") {
      return sendMessage(
        chatId,
        "🎨 <b>WELCOME TO KALID GIF & EMOJI STUDIO!</b>\n\n" +
        "Create your own amazing GIFs, Emojis and Stickers! ❤️\n\n" +
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

    if (text === "/emoji") {
      return sendMessage(chatId, "😀 <b>EMOJI MAKER</b>\n\nSend a photo to start creating your custom emoji.");
    }

    if (text === "/gif") {
      return sendMessage(chatId, "🎬 <b>GIF MAKER</b>\n\nSend a short video to prepare a GIF.");
    }

    if (text === "/sticker") {
      return sendMessage(chatId, "🥰 <b>STICKER MAKER</b>\n\nSend a photo to start creating your sticker.");
    }

    if (text === "/animated") {
      return sendMessage(chatId, "🔥 <b>ANIMATED STICKER</b>\n\nSend a short video to prepare an animated sticker.");
    }

    if (text === "/pack") {
      return sendMessage(chatId, "📦 <b>STICKER PACK</b>\n\nFirst, create or prepare your stickers. We will help you organize them into a pack.");
    }

    if (text === "/help") {
      return sendMessage(chatId, "❓ <b>KALID STUDIO HELP</b>\n\n/start - Open menu\n/emoji - Emoji Maker\n/gif - GIF Maker\n/sticker - Sticker Maker\n/animated - Animated Sticker\n/pack - Sticker Pack");
    }

    if (message.photo) {
      return sendMessage(chatId, "📸 Photo received!\n\nYour image is ready for the next sticker or emoji processing step.");
    }

    if (message.video || message.animation) {
      return sendMessage(chatId, "🎬 Video received!\n\nYour video is ready for the next GIF processing step.");
    }

    if (text) {
      return sendMessage(chatId, "👋 Welcome to KALID STUDIO!\n\nPlease use /start to see all available features.");
    }
  }

  if (update.callback_query) {
    const query = update.callback_query;
    const chatId = query.message.chat.id;
    const data = query.data;

    await axios.post(`${API}/answerCallbackQuery`, {
      callback_query_id: query.id
    }).catch(() => {});

    const messages = {
      emoji: "😀 <b>EMOJI MAKER</b>\n\nSend a photo to begin preparing your custom emoji.",
      gif: "🎬 <b>GIF MAKER</b>\n\nSend a short video to begin preparing your GIF.",
      sticker: "🥰 <b>STICKER MAKER</b>\n\nSend a photo to prepare your sticker.",
      animated: "🔥 <b>ANIMATED STICKER</b>\n\nSend a short video to prepare your animated sticker.",
      pack: "📦 <b>STICKER PACK</b>\n\nPrepare your stickers first. Then we can organize them into a pack.",
      help: "❓ <b>HELP CENTER</b>\n\nUse the menu to choose Emoji, GIF, Sticker or Sticker Pack."
    };

    return sendMessage(chatId, messages[data] || "Please choose an option from the menu.");
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`KALID GIF & EMOJI STUDIO running on port ${PORT}`);
});