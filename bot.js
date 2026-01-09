import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// ------------------------------------------------------
// EXPRESS SERVER (Render keep-alive)
// ------------------------------------------------------
const app = express();
app.get("/", (req, res) => res.send("Irfizio bot online"));
app.listen(3000, () => console.log("Web server running on 3000"));

// ------------------------------------------------------
// ENV VARIABLES
// ------------------------------------------------------
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

// ------------------------------------------------------
// DISCORD CLIENT
// ------------------------------------------------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ------------------------------------------------------
// ALL CLUB LISTS
// ------------------------------------------------------

// Premier League
const premierLeague = [
    "Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
    "Chelsea","Crystal Palace","Everton","Fulham","Liverpool",
    "Luton","Manchester City","Man City","Manchester United","Man United",
    "Newcastle","Nottingham Forest","Sheffield United","Tottenham","Spurs",
    "West Ham","Wolves","Wolverhampton"
];

// La Liga
const laLiga = [
    "Alaves","Athletic Club","Atletico Madrid","Atleti","Barcelona","Barça",
    "Cadiz","Celta Vigo","Getafe","Girona","Granada","Las Palmas",
    "Mallorca","Osasuna","Rayo Vallecano","Real Betis","Real Madrid",
    "Real Sociedad","Sevilla","Valencia","Villarreal"
];

// Ligue 1 (selected only)
const ligue1 = [
    "Paris Saint-Germain","PSG","Lyon","Marseille"
];

// Bundesliga (selected only)
const bundesliga = [
    "Bayern Munich","Bayern","Bayer Leverkusen","Leverkusen",
    "Borussia Dortmund","Dortmund","Eintracht Frankfurt"
];

// Serie A (selected only)
const serieA = [
    "Inter","Internazionale",
    "Juventus","Juve",
    "Milan","AC Milan",
    "Napoli","Roma"
];

// ALL clubs for /transfers and /rumours
const allClubs = [
    ...premierLeague,
    ...laLiga,
    ...ligue1,
    ...bundesliga,
    ...serieA
];

// AUTO POST CLUBS (same as above)
const autoClubs = allClubs;

// ------------------------------------------------------
// COMMANDS
// ------------------------------------------------------
const commands = [
    { name: "transfers", description: "Official transfers from top leagues" },
    { name: "rumours", description: "Rumours (text formats only) from GOAL" }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// Register commands
async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands(client.user?.id, GUILD_ID),
        { body: commands }
    );
    console.log("Slash commands registered.");
}

// ------------------------------------------------------
// LOAD GOAL HTML
// ------------------------------------------------------
async function loadGoal() {
    const res = await fetch("https://www.goal.com/en/transfer-news", {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    return cheerio.load(await res.text());
}

// ------------------------------------------------------
// GET ALL TEXT HEADLINES (NO VIDEO)
// ------------------------------------------------------
function extractTextHeadlines($) {
    const selectors = [
        ".type-article .title",
        ".type-list .title",
        ".type-story .title",
        ".type-analysis .title",
        ".type-gallery .title",
        ".type-tags .title"
        // --- type-video intentionally excluded ---
    ];

    const results = [];

    selectors.forEach(sel => {
        $(sel).each((i, el) => {
            const t = $(el).text().trim();
            if (t) results.push(t);
        });
    });

    return results;
}

// ------------------------------------------------------
// GET OFFICIAL TRANSFERS
// ------------------------------------------------------
async function getOfficialTransfers() {
    const $ = await loadGoal();
    const titles = extractTextHeadlines($);

    const officialWords = ["official", "confirmed", "deal", "joins", "signs"];

    return titles
        .filter(t => officialWords.some(w => t.toLowerCase().includes(w)))
        .filter(t => allClubs.some(c => t.toLowerCase().includes(c.toLowerCase())))
        .slice(0, 20)
        .map(t => ({ text: t }));
}

// ------------------------------------------------------
// GET RUMOURS (TEXT FORMATS ONLY)
// ------------------------------------------------------
async function getRumours() {
    const $ = await loadGoal();
    const titles = extractTextHeadlines($);

    const rumourWords = [
        "linked","target","interest","interested",
        "monitoring","eyeing","approach","offer","bid",
        "could","move"
    ];

    return titles
        .filter(t => rumourWords.some(w => t.toLowerCase().includes(w)))
        .filter(t => allClubs.some(c => t.toLowerCase().includes(c.toLowerCase())))
        .slice(0, 20)
        .map(t => ({ text: t }));
}

// ------------------------------------------------------
// EMBEDS
// ------------------------------------------------------
function embedOfficial(list) {
    const e = new EmbedBuilder()
        .setColor("#00FF9D")
        .setTitle("✅ Official Transfers")
        .setTimestamp();

    if (list.length === 0)
        e.addFields({ name: "No official transfers", value: "Try again later." });
    else
        list.forEach(t => e.addFields({ name: " ", value: `• ${t.text}` }));

    return e;
}

function embedRumours(list) {
    const e = new EmbedBuilder()
        .setColor("#FFD000")
        .setTitle("🟡 Transfer Rumours")
        .setTimestamp();

    if (list.length === 0)
        e.addFields({ name: "No rumours", value: "Try again later." });
    else
        list.forEach(t => e.addFields({ name: " ", value: `• ${t.text}` }));

    return e;
}

// ------------------------------------------------------
// AUTO CHECK — ONLY OFFICIAL, ONLY SELECTED CLUBS
// ------------------------------------------------------
let lastAuto = [];

async function autoCheck() {
    try {
        const $ = await loadGoal();
        const titles = extractTextHeadlines($);

        const officialWords = ["official", "confirmed", "deal", "joins", "signs"];

        const newResults = titles
            .filter(t => officialWords.some(w => t.toLowerCase().includes(w)))
            .filter(t => autoClubs.some(c => t.toLowerCase().includes(c.toLowerCase())))
            .map(t => ({ text: t }));

        if (JSON.stringify(newResults) !== JSON.stringify(lastAuto)) {
            const ch = client.channels.cache.get(CHANNEL_ID);

            if (newResults.length > 0 && ch) {
                ch.send({ embeds: [embedOfficial(newResults)] });
            }

            lastAuto = newResults;
        }
    } catch (err) {
        console.log("Auto-check error:", err);
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

    if (interaction.commandName === "transfers")
        return interaction.reply({ embeds: [embedOfficial(await getOfficialTransfers())] });

    if (interaction.commandName === "rumours")
        return interaction.reply({ embeds: [embedRumours(await getRumours())] });
});

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------
client.login(TOKEN);

