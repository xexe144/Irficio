import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// ------------------------------------------------------
// EXPRESS SERVER (нужно за Render)
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
// SLASH COMMANDS
// ------------------------------------------------------
const commands = [
    { name: "transfers", description: "Shows official transfers from top leagues" },
    { name: "rumours", description: "Shows rumours & potential moves from top leagues" }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
        body: commands
    });
    console.log("Slash commands registered.");
}

// ------------------------------------------------------
// LEAGUE CLUB LISTS
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

// Serie A
const serieA = [
    "Atalanta","Bologna","Cagliari","Empoli","Fiorentina","Frosinone",
    "Genoa","Inter","Juventus","Juve","Lazio","Lecce","Milan","AC Milan",
    "Monza","Napoli","Roma","Salernitana","Sassuolo","Torino",
    "Udinese","Verona"
];

// Bundesliga
const bundesliga = [
    "Augsburg","Bayer Leverkusen","Leverkusen","Bayern Munich","Bayern",
    "Bochum","Borussia Dortmund","Dortmund","Borussia Monchengladbach","Gladbach",
    "Eintracht Frankfurt","Freiburg","Heidenheim","Hoffenheim",
    "Mainz","RB Leipzig","Union Berlin","Stuttgart",
    "Werder Bremen","Wolfsburg"
];

// Ligue 1
const ligue1 = [
    "Paris Saint-Germain","PSG","Lille","Lyon","Marseille","Monaco",
    "Nice","Rennes","Lens","Nantes","Montpellier","Reims",
    "Toulouse","Strasbourg","Brest","Metz","Le Havre","Saint-Etienne","Auxerre"
];

// Super Lig (only 3)
const superLig = ["Galatasaray", "Fenerbahce", "Besiktas"];

// Combined
const allClubs = [
    ...premierLeague,
    ...laLiga,
    ...serieA,
    ...bundesliga,
    ...ligue1,
    ...superLig
];

// ------------------------------------------------------
// SCRAPER — GOAL.COM
// ------------------------------------------------------
async function scrapeGoal() {
    const url = "https://www.goal.com/en/transfer-news";

    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    const html = await res.text();
    return cheerio.load(html);
}

// --- OFFICIAL ---
async function getOfficialTransfers() {
    const $ = await scrapeGoal();

    const officialWords = ["official", "confirmed", "deal", "joins", "signs"];

    const results = [];
    $(".type-article .title").each((i, el) => {
        let title = $(el).text().trim();
        if (!title) return;

        // must be official
        if (!officialWords.some(w => title.toLowerCase().includes(w))) return;

        // must include a club
        if (!allClubs.some(club => title.toLowerCase().includes(club.toLowerCase()))) return;

        results.push({ text: title });
    });

    return results.slice(0, 15);
}

// --- RUMOURS ---
async function getRumours() {
    const $ = await scrapeGoal();

    const rumourWords = [
        "linked","target","interest","interested","monitoring",
        "eyeing","approach","offer","bid","could","move"
    ];

    const results = [];
    $(".type-article .title").each((i, el) => {
        let title = $(el).text().trim();
        if (!title) return;

        if (!rumourWords.some(w => title.toLowerCase().includes(w))) return;
        if (!allClubs.some(club => title.toLowerCase().includes(club.toLowerCase()))) return;

        results.push({ text: title });
    });

    return results.slice(0, 15);
}

// ------------------------------------------------------
// EMBEDS
// ------------------------------------------------------
function embedOfficial(list) {
    const e = new EmbedBuilder()
        .setColor("#00FF9D")
        .setTitle("✅ Official Transfers")
        .setTimestamp();

    if (list.length === 0) {
        e.addFields({ name: "No official transfers", value: "Try again later." });
    } else {
        list.forEach(t => e.addFields({ name: " ", value: `• ${t.text}` }));
    }

    return e;
}

function embedRumours(list) {
    const e = new EmbedBuilder()
        .setColor("#FFD000")
        .setTitle("🟡 Transfer Rumours")
        .setTimestamp();

    if (list.length === 0) {
        e.addFields({ name: "No rumours", value: "Try again later." });
    } else {
        list.forEach(t => e.addFields({ name: " ", value: `• ${t.text}` }));
    }

    return e;
}

// ------------------------------------------------------
// AUTO CHECK — EVERY 10 MIN — ONLY OFFICIAL TRANSFERS
// ------------------------------------------------------
let lastOfficial = [];

async function autoCheck() {
    try {
        const official = await getOfficialTransfers();

        // ONLY if different → send
        if (JSON.stringify(official) !== JSON.stringify(lastOfficial)) {
            const ch = client.channels.cache.get(CHANNEL_ID);
            if (official.length > 0 && ch) {
                ch.send({ embeds: [embedOfficial(official)] });
            }
            lastOfficial = official;
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
        return interaction.reply({ embeds: [embedOfficial(await getOfficialTransfers())] });
    }

    if (interaction.commandName === "rumours") {
        return interaction.reply({ embeds: [embedRumours(await getRumours())] });
    }
});

// ------------------------------------------------------
// LOGIN
// ------------------------------------------------------
client.login(TOKEN);

