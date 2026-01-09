import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// ------------------------------------------------------
// EXPRESS WEB SERVER (НЕ ПИПАЙ) – нужно за Render
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
        description: "Shows latest official transfer news"
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
// SCRAPE FOOTBALLTRANSFERS.COM (работи стабилно)
// ------------------------------------------------------
async function getOfficialTransfers() {
    const url = "https://www.footballtransfers.com/en/transfers";

    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];

    $(".latest-transfers table tbody tr").each((i, el) => {
        const player = $(el).find(".player-name").text().trim();
        const to = $(el).find(".team.to").text().trim();
        const fee = $(el).find(".fee").text().trim();

        if (!player) return;

        results.push({
            text: `${player} to ${to} (${fee || "free"})`
        });
    });

    return results.slice(0, 10);
}


// ------------------------------------------------------
// EMBED BUILDER – ULTRA CLEAN (D)
// ------------------------------------------------------
function makeEmbed(transfers) {
    const embed = new EmbedBuilder()
        .setColor("#00FFFF")
        .setTitle("📢 Latest Transfer News")
        .setTimestamp();

    if (transfers.length === 0) {
        embed.addFields({
            name: "No transfers found",
            value: "Try again later.",
            inline: false
        });
        return embed;
    }

    transfers.forEach(t => {
        embed.addFields({
            name: " ",
            value: `• ${t.text}`,
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





