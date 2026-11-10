const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_BOT_TOKEN?.trim();
const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.RENDER_EXTERNAL_URL;

if (!TOKEN) {
console.error("ERROR: TELEGRAM_BOT_TOKEN is missing!");
process.exit(1);
}

const API = "https://api.telegram.org/bot${TOKEN}";

async function sendMessage(chatId, message, keyboard = null) {
try {
const response = await axios.post("${API}/sendMessage", {
chat_id: chatId,
text: message,
parse_mode: "HTML",
...(keyboard ? {
reply_markup: { inline_keyboard: keyboard }
} : {})
});

console.log("Message sent:", response.data.ok);

} catch (error) {
console.error(
"SEND MESSAGE ERROR:",
error.response?.data || error.message
);
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

if (update.message) {
  const message = update.message;
  const chatId = message.chat.id;
  const text = message.text || "";

  if (text === "/start") {
    return sendMessage(
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
    "/emoji": "😀 <b>EMOJI MAKER</b>\n\nSend a photo to begin.",
    "/gif": "🎬 <b>GIF MAKER</b>\n\nSend a short video to begin.",
    "/sticker": "🥰 <b>STICKER MAKER</b>\n\nSend a photo to begin.",
    "/animated": "🔥 <b>ANIMATED STICKER</b>\n\nSend a short video to begin.",
    "/pack": "📦 <b>STICKER PACK</b>\n\nPrepare your stickers first.",
    "/help": "❓ <b>HELP</b>\n\n/start - Main menu\n/emoji - Emoji Maker\n/gif - GIF Maker\n/sticker - Sticker Maker\n/animated - Animated Sticker\n/pack - Sticker Pack"
  };

  if (commands[text]) {
    return sendMessage(chatId, commands[text]);
  }

  if (message.photo) {
    return sendMessage(
      chatId,
      "📸 Photo received! Actual sticker creation is coming next."
    );
  }

  if (message.video || message.animation) {
    return sendMessage(
      chatId,
      "🎬 Video received! Actual GIF creation is coming next."
    );
  }

  if (text) {
    return sendMessage(
      chatId,
      "👋 Welcome! Please send /start to open the menu."
    );
  }
}

if (update.callback_query) {
  const query = update.callback_query;
  const chatId = query.message.chat.id;

  await axios.post(`${API}/answerCallbackQuery`, {
    callback_query_id: query.id
  });

  const responses = {
    emoji: "😀 <b>EMOJI MAKER</b>\n\nSend a photo to begin.",
    gif: "🎬 <b>GIF MAKER</b>\n\nSend a short video to begin.",
    sticker: "🥰 <b>STICKER MAKER</b>\n\nSend a photo to begin.",
    animated: "🔥 <b>ANIMATED STICKER</b>\n\nSend a short video to begin.",
    pack: "📦 <b>STICKER PACK</b>\n\nPrepare your stickers first.",
    help: "❓ <b>HELP CENTER</b>\n\nUse /start to open the menu."
  };

  return sendMessage(
    chatId,
    responses[query.data] || "Please choose an option."
  );
}

} catch (error) {
console.error(
"WEBHOOK PROCESSING ERROR:",
error.response?.data || error.message
);
}
});

app.listen(PORT, async () => {
console.log("KALID GIF & EMOJI STUDIO running on port ${PORT}");

try {
console.log("Checking Telegram bot token...");

const botResponse = await axios.get(`${API}/getMe`);

if (!botResponse.data.ok) {
  throw new Error("Telegram bot authentication failed.");
}

console.log(
  "TELEGRAM BOT CONNECTED:",
  botResponse.data.result.username
);

if (!BASE_URL) {
  throw new Error("RENDER_EXTERNAL_URL is missing!");
}

const webhookURL =
  `${BASE_URL.replace(/\/+$/, "")}/webhook`;

console.log("Registering webhook...");

const webhookResponse = await axios.post(
  `${API}/setWebhook`,
  { url: webhookURL }
);

console.log("WEBHOOK RESULT:", webhookResponse.data);

} catch (error) {
console.error(
"STARTUP ERROR:",
error.response?.data || error.message
);
}
});