const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = "https://api.telegram.org/bot${TOKEN}";

async function sendMessage(chatId, text, keyboard = null) {
try {
await axios.post("${API}/sendMessage", {
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
res.send("KALID GIF & EMOJI STUDIO is LIVE! 🚀");
});

app.get("/healthz", (req, res) => {
res.status(200).send("OK");
});

app.post("/webhook", async (req, res) => {
res.sendStatus(200);

try {
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
    return sendMessage(chatId, "😀 <b>EMOJI MAKER</b>\n\nSend a photo to start preparing your custom emoji.");
  }

  if (text === "/gif") {
    return sendMessage(chatId, "🎬 <b>GIF MAKER</b>\n\nSend a short video to prepare a GIF.");
  }

  if (text === "/sticker") {
    return sendMessage(chatId, "🥰 <b>STICKER MAKER</b>\n\nSend a photo to prepare your sticker.");
  }

  if (text === "/animated") {
    return sendMessage(chatId, "🔥 <b>ANIMATED STICKER</b>\n\nSend a short video to prepare your animated sticker.");
  }

  if (text === "/pack") {
    return sendMessage(chatId, "📦 <b>STICKER PACK</b>\n\nPrepare your stickers first. Then organize them into a pack.");
  }

  if (text === "/help") {
    return sendMessage(chatId, "❓ <b>KALID STUDIO HELP</b>\n\n/start - Open menu\n/emoji - Emoji Maker\n/gif - GIF Maker\n/sticker - Sticker Maker\n/animated - Animated Sticker\n/pack - Sticker Pack");
  }

  if (message.photo) {
    return sendMessage(chatId, "📸 Photo received! Sticker processing will be added next.");
  }

  if (message.video || message.animation) {
    return sendMessage(chatId, "🎬 Video received! GIF processing will be added next.");
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
    emoji: "😀 <b>EMOJI MAKER</b>\n\nSend a photo to begin.",
    gif: "🎬 <b>GIF MAKER</b>\n\nSend a short video to begin.",
    sticker: "🥰 <b>STICKER MAKER</b>\n\nSend a photo to begin.",
    animated: "🔥 <b>ANIMATED STICKER</b>\n\nSend a short video to begin.",
    pack: "📦 <b>STICKER PACK</b>\n\nPrepare your stickers first.",
    help: "❓ <b>HELP CENTER</b>\n\nChoose Emoji, GIF, Sticker or Sticker Pack."
  };

  return sendMessage(chatId, messages[data] || "Please choose an option.");
}

} catch (error) {
console.error("Webhook processing error:", error);
}
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, async () => {
console.log("KALID GIF & EMOJI STUDIO running on port ${PORT}");

try {
const webhookURL = "${process.env.RENDER_EXTERNAL_URL}/webhook";

const response = await axios.post(`${API}/setWebhook`, {
  url: webhookURL
});

console.log("Webhook setup:", response.data);

} catch (error) {
console.error("Webhook error:", error.response?.data || error.message);
}
});