import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";

// ------------------------------------------------------
// EXPRESS WEB SERVER (НЕ ПИПАЙ) – НУЖНО Е ЗА RENDER
// ------------------------------------------------------
const app = express();
app.get("/", (req, res) => res.send("Irfizio bot is running"));
app.listen(3000, () => console.log("Web server running on port 3000"));


// ------------------------------------------------------
// ENV VARIABLES (Render ги чете автоматично)
// ------------------------------------------------------
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;


// ------------------------------------------------------
// DISCORD CLIENT
// ------------------------------------------------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

let lastTransfers = [];


// ------------------------------------------------------
// SLASH COMMANDS
// ------------------------------------------------------
const commands = [
    {
        name: "transfers",
        description: "Shows latest official transfer news from Fabrizio Romano"
    }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands(client.user.id, GUILD_ID),
        { body: commands }
    );
    console.log("Slash commands registered.");
}


// ------------------------------------------------------
// FETCH FABRIZIO ROMANO OFFICIAL TRANSFERS
// ------------------------------------------------------
async function getOfficialTransfers() {
    const url = "https://api.twii.dev/user/fabrizioromano/tweets";

    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        }
    });

    const data = await res.json();
    const tweets = data.tweets || [];

    const keywords = [
        "here we go",
        "official",
        "confirmed",
        "deal",
        "joins",
        "signs",
        "completed"
    ];

    const filtered = tweets.filter(t =>
        keywords.some(k => t.text.toLowerCase().includes(k))
    );

    const cleaned = filtered.slice(0, 10).map(t => ({
        text: t.text.replace(/\n/g, " ").trim(),
        url: `https://twitter.com/FabrizioRomano/status/${t.id}`
    }));

    return cleaned;
}


// ------------------------------------------------------
// EMBED BUILDER
// ------------------------------------------------------
function makeEmbed(transfers) {
    const embed = new EmbedBuilder()
        .setColor("#00FFFF")
        .setTitle("📢 Irfizio – Latest Transfer News (Fabrizio Romano)")
        .setTimestamp();

    if (transfers.length === 0) {
        embed.addFields({ name: "No official transfers", value: "Check again later." });
        return embed;
    }

    transfers.forEach(t => {
        embed.addFields({
            name: " ",
            value: `• ${t.text}\n[🔗 Tweet](${t.url})`,
            inline: false
        });
    });

    return embed;
}


// ------------------------------------------------------
// AUTO CHECK EVERY 10 MIN
// ------------------------------------------------------
async function autoCheck() {
    try {
        const transfers = await getOfficialTransfers();

        if (JSON.stringify(transfers) !== JSON.stringify(lastTransfers)) {
            const ch = client.channels.cache.get(CHANNEL_ID);
            if (ch) ch.send({ embeds: [makeEmbed(transfers)] });
            lastTransfers = transfers;
        }
    } catch (err) {
        console.error("Auto-check error:", err);
    }
}


// ------------------------------------------------------
// DISCORD EVENTS
// ------------------------------------------------------
client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}`);
    await registerCommands();

    autoCheck();
    setInterval(autoCheck, 10 * 60 * 1000);
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "transfers") {
        const transfers = await getOfficialTransfers();
        await interaction.reply({ embeds: [makeEmbed(transfers)] });
    }
});


// ------------------------------------------------------
// BOT LOGIN
// ------------------------------------------------------
client.login(TOKEN);




