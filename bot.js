
import express from "express";
import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

// ------------------------------------------------------
// EXPRESS WEB SERVER (нужно за Render)
// ------------------------------------------------------
const app = express();
app.get("/", (req, res) => res.send("Irfizio bot running"));
app.listen(3000, () => console.log("Web server running on 3000"));


// ------------------------------------------------------
// ENV VARIABLES (Render ги чете)
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
        description: "Shows latest transfer news from top leagues"
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
// FULL LEAGUE FILTER LISTS
// ------------------------------------------------------

const premierLeague = [
    "Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
    "Chelsea","Crystal Palace","Everton","Fulham","Liverpool",
    "Luton","Manchester City","Man City","Manchester United","Man United",
    "Newcastle","Nottingham Forest","Sheffield United","Tottenham","Spurs",
    "West Ham","Wolves","Wolverhampton"
];

const laLiga = [
    "Alaves","Athletic Club","Atletico Madrid","Atleti","Barcelona","Barça",
    "Cadiz","Celta Vigo","Getafe","Girona","Granada","Las Palmas",
    "Mallorca","Osasuna","Rayo Vallecano","Real Betis","Real Madrid",
    "Real Sociedad","Sevilla","Valencia","Villarreal"
];

const serieA = [
    "Atalanta","Bologna","Cagliari","Empoli","Fiorentina","Frosinone",
    "Genoa","Inter","Juventus","Juve","Lazio","Lecce","Milan","AC Milan",
    "Monza","Napoli","Roma","Salernitana","Sassuolo","Torino",
    "Udinese","Verona"
];

const bundesliga = [
    "Augsburg","Bayer Leverkusen","Leverkusen","Bayern Munich","Bayern",
    "Bochum","Borussia Dortmund","Dortmund","Borussia Monchengladbach","Gladbach",
    "Eintracht Frankfurt","Freiburg","Heidenheim","Hoffenheim",
    "Mainz","RB Leipzig","Union Berlin","Stuttgart",
    "Werder Bremen","Wolfsburg"
];

const bigLeaguesClubs = [
    ...premierLeague,
    ...laLiga,
    ...serieA,
    ...bundesliga
];


// ------------------------------------------------------
// SCRAPING GOAL.COM (стабилно)
// ------------------------------------------------------
async function getOfficialTransfers() {
    const url = "https://www.goal.com/en/transfer-news";

    const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
    });

    const html = await res.text();
    const $ = cheerio.load(html);

    const results = [];

    $(".type-article .title").each((i, el) => {
        let title = $(el).text().trim();
        if (!title) return;

        // official words only
        const goodWords = ["official", "confirmed", "deal", "joins", "signs"];
        if (!goodWords.some(w => title.toLowerCase().includes(w))) return;

        // filter by league clubs
        if (!bigLeaguesClubs.some(club =>
            title.toLowerCase().includes(club.toLowerCase())
        )) return;

        results.push({ text: title });
    });

    return results.slice(0, 10);
}


// ------------------------------------------------------
// EMBED BUILDER (ULTRA CLEAN STYLE)
// ------------------------------------------------------
function makeEmbed(transfers) {
    const embed = new EmbedBuilder()
        .setColor("#00FFFF")
        .setTitle("📢 Latest Transfer News (Top 4 Leagues)")
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
// LOGIN
// ------------------------------------------------------
client.login(TOKEN);



