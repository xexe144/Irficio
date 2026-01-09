import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// ------------------------------------------------------
// EXPRESS SERVER
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
// LEAGUE CLUB LISTS (FULL)
// ------------------------------------------------------

// Premier League (20)
const premierLeague = [
    "Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
    "Chelsea","Crystal Palace","Everton","Fulham","Liverpool",
    "Luton","Manchester City","Man City","Manchester United","Man United",
    "Newcastle","Nottingham Forest","Sheffield United","Tottenham","Spurs",
    "West Ham","Wolves","Wolverhampton"
];

// La Liga (20)
const laLiga = [
    "Alaves","Athletic Club","Atletico Madrid","Atleti","Barcelona","Barça",
    "Cadiz","Celta Vigo","Getafe","Girona","Granada","Las Palmas",
    "Mallorca","Osasuna","Rayo Vallecano","Real Betis","Real Madrid",
    "Real Sociedad","Sevilla","Valencia","Villarreal"
];

// Ligue 1 (3 selected)
const ligue1 = [
    "Paris Saint-Germain","PSG","Lyon","Marseille"
];

// Bundesliga (4 selected)
const bundesliga = [
    "Bayern Munich","Bayern",
    "Bayer Leverkusen","Leverkusen",
    "Borussia Dortmund","Dortmund",
    "Eintracht Frankfurt"
];

// Serie A (5 selected)
const serieA = [
    "Inter","Internazionale",
    "Juventus","Juve",
    "Milan","AC Milan",
    "Napoli",
    "Roma"
];

// For /transfers command → all 6 leagues
const allClubs = [
    ...premierLeague,
    ...laLiga,
    ...[
        "Paris Saint-Germain","PSG","Lyon","Marseille"
    ],
    ...[
        "Bayern Munich","Bayern","Bayer Leverkusen","Leverkusen",
        "Borussia Dortmund","Dortmund","Eintracht Frankfurt"
    ],
    ...[
        "Inter","Internazionale","Juventus","Juve",
        "Milan","AC Milan","Napoli","Roma"
    ]
];

// For AUTO-CHECK → same list (only official)
const autoClubs = allClubs;

// ------------------------------------------------------
// SLASH COMMANDS
// ------------------------------------------------------
const commands = [
    { name: "transfers", description: "Official transfers from top leagues" },
    { name: "rumours", description: "Rumours from top leagues" }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

// ------------------------------------------------------
// REGISTER COMMANDS
// ------------------------------------------------------
async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands(client.user.id, GUILD_ID),
        { body: commands }
    );
    console.log("Slash commands registered.");
}

// ------------------------------------------------------
// SCRAPING GOAL.COM
// ------------------------------------------------------
async function loadGoal() {
    const res = await fetch("https://www.goal.com/en/transfer-news", {
        headers: { "User-Agent": "Mozilla/5.0" }
    });
    const html = await res.text();
    return cheerio.load(html);
}

// ------------------------------------------------------
// OFFICIAL TRANSFERS
// ------------------------------------------------------
async function getOfficialTransfers() {
    const $ = await loadGoal();

    const officialWords = ["official", "confirmed", "deal", "joins", "signs"];

    const results = [];

    $(".type-article .title").each((i, el) => {
        const t = $(el).text().trim();
        if (!t) return;

        if (!officialWords.some(w => t.toLowerCase().includes(w))) return;
        if (!allClubs.some(c => t.toLowerCase().includes(c.toLowerCase()))) return;

        results.push({ text: t });
    });

    return results.slice(0, 20);
}

// ------------------------------------------------------
// RUMOURS
// ------------------------------------------------------
async function getRumours() {
    const $ = await loadGoal();

    const rumourWords = [
        "linked","target","interest","interested",
        "monitoring","eyeing","approach","offer",
        "bid","could","move"
    ];

    const results = [];

    $(".type-article .title").each((i, el) => {
        const t = $(el).text().trim();
        if (!t) return;

        if (!rumourWords.some(w => t.toLowerCase().includes(w))) return;
        if (!allClubs.some(c => t.toLowerCase().includes(c.toLowerCase()))) return;

        results.push({ text: t });
    });

    return results.slice(0, 20);
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
// AUTO CHECK — ONLY OFFICIAL — ONLY SELECTED CLUBS
// ------------------------------------------------------
let lastAuto = [];

async function autoCheck() {
    try {
        const $ = await loadGoal();

        const officialWords = ["official", "confirmed", "deal", "joins", "signs"];
        const newResults = [];

        $(".type-article .title").each((i, el) => {
            const t = $(el).text().trim();
            if (!t) return;

            if (!officialWords.some(w => t.toLowerCase().includes(w))) return;
            if (!autoClubs.some(c => t.toLowerCase().includes(c.toLowerCase()))) return;

            newResults.push({ text: t });
        });

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
