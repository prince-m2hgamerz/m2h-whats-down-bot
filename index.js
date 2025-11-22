require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// ADMIN number for error logs
const ADMIN = "919818322072";

// =============================================================
//  SMART GREETING DETECTION (AI-STYLE)
// =============================================================
function isGreeting(text) {
    if (!text) return false;
    text = text.toLowerCase().trim();

    // 1. Greeting Emojis
    const emojiGreetings = ["👋", "🙏", "🤝", "🙌"];
    if (emojiGreetings.some(e => text.includes(e))) return true;

    // 2. Exact keywords
    const greetKeywords = [
        "hi", "hello", "hey", "hii", "start", "menu",

        // Hindi / Hinglish greetings
        "namaste", "namaskar", "ram ram", "radhe radhe",
        "pranam", "salaam", "salam", "assalamualaikum",

        // Short greetings
        "yo", "sup", "hola", "bonjour",

        // Friendly bot calls
        "hi bot", "hello bot", "hey bot",
        "hello m2h", "hi m2h", "prince", "priya",

        // Time-based greetings
        "good morning", "gm", "good night", "gn",
        "good afternoon", "good evening",

        // Start variations
        "start bot", "start now", "begin", "run",

        // Help requests
        "help", "info", "support"
    ];

    // 3. Exact match
    if (greetKeywords.includes(text)) return true;

    // 4. Fuzzy detection (helloooo, hiiiiii, heyyy, salaammm)
    const fuzzyGreetings = ["hi", "hello", "hey", "hii", "namaste", "salam"];
    for (let g of fuzzyGreetings) {
        if (text.startsWith(g)) return true;
        if (text.includes(g)) return true;
    }

    // 5. Regex pattern detection
    const hinglishPatterns = [
        /namaste+/i,
        /salaam+/i,
        /hell+o+/i,
        /h+i+/i,
        /he+y+/i
    ];
    if (hinglishPatterns.some(p => p.test(text))) return true;

    return false;
}

// =============================================================
// SEND WHATSAPP MESSAGE
// =============================================================
async function sendMessage(to, message) {
    try {
        await axios.post(
            `https://graph.facebook.com/v22.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to: to,
                text: { body: message }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json",
                }
            }
        );
    } catch (err) {
        console.log("SendMessage ERROR:", err.response?.data || err.message);
    }
}

// =============================================================
// SEND ERROR LOG TO ADMIN
// =============================================================
async function sendErrorLog(errorText) {
    await sendMessage(
        ADMIN,
        `🚨 *ERROR LOG*\n${errorText}`
    );
}

// =============================================================
// VERIFY WEBHOOK
// =============================================================
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
        console.log("Webhook Verified Successfully 💚");
        return res.status(200).send(challenge);
    }

    res.sendStatus(403);
});

// =============================================================
// RECEIVE WEBHOOK EVENTS
// =============================================================
app.post("/webhook", async (req, res) => {
    try {
        const data = req.body;

        if (data.object !== "whatsapp_business_account")
            return res.sendStatus(200);

        const entry = data.entry?.[0];
        const change = entry?.changes?.[0]?.value;
        const msg = change?.messages?.[0];

        if (!msg) return res.sendStatus(200);

        const from = msg.from;
        const text = msg.text?.body?.trim() || "";

        console.log("User Sent:", text);

        // =============================================================
        // SMART GREETING RESPONSE
        // =============================================================
        if (isGreeting(text)) {
            await sendMessage(
                from,
                "🎉 *Welcome to Priya × Prince x Abhi Downloader Bot!* 🎉\n\n" +
                "Send me any *Video/Image/Reel/Short* link and I'll fetch the *direct download link* ⚡\n\n" +
                "🌐 Supported Platforms:\n" +
                "• YouTube\n" +
                "• Instagram\n" +
                "• Facebook\n" +
                "• Pinterest\n\n" +
                "➡ Try sending any link now!"
            );
            return res.sendStatus(200);
        }

        // =============================================================
        // CHECK IF USER SENT A LINK
        // =============================================================
        if (!text.startsWith("http")) {
            await sendMessage(from,
                "❌ Invalid link!\nPlease send a valid video/image URL.\n\nExample:\nhttps://youtube.com/shorts/xyz \n https://instagram.com/p/xyz"
            );
            return res.sendStatus(200);
        }

        // =============================================================
        // CALL DOWNLOADER API
        // =============================================================
        const apiUrl = `https://wadownloader.amitdas.site/api/?url=${encodeURIComponent(text)}`;
        console.log("Calling API:", apiUrl);

        try {
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (response.data.status === "success") {
                const mediaUrl = response.data.media_url;
                console.log("Media Found:", mediaUrl);

                await sendMessage(from, mediaUrl);
            } else {
                await sendMessage(
                    from,
                    "⚠️ Unable to download from this link.\nLink might be private or unsupported."
                );
            }
        } catch (apiErr) {
            console.log("Downloader API ERROR:", apiErr.message);

            await sendMessage(from, `⚠ API Error: ${apiErr.message}`);

            // SEND ERROR LOG TO ADMIN
            await sendErrorLog(
                `📌 API ERROR\nFrom: ${from}\nLink: ${text}\nError: ${apiErr.message}`
            );
        }

        res.sendStatus(200);

    } catch (err) {
        console.log("Webhook ERROR:", err.message);
        await sendErrorLog(`CRITICAL ERROR:\n${err.stack || err.message}`);
        res.sendStatus(500);
    }
});

// =============================================================
// START SERVER
// =============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
    console.log(`🚀 Priya × Prince WhatsApp Bot running on PORT ${PORT}`)
);
