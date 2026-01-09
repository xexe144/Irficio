import { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } from "discord.js";
import fetch from "node-fetch";

// ---------------------------------------
// CONFIG (без токен в кода!)
const TOKEN = process.env.TOKEN;          // токенът идва от Render
const GUILD_ID = process.env.GUILD_ID;    // ще го добавиш в Render
const CHANNEL_ID = process.env.CHANNEL_ID; // ще го добавиш в Render
// ---------------------------------------

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

let lastTransfers = [];

// ------------- REGISTER SLASH COMMAND -------------
const commands = [
    {
        name: "transfers",
        description: "Показва последните официални футболни трансфери"
    }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands((await client.application)?.id, GUILD_ID),
        { body: commands }
    );
    console.log("Slash командите са регистрирани.");
}

// ------------- FETCH OFFICIAL TRANSFERS -------------
async function getOfficialTransfers() {
    const url = "https://www.transfermarkt.com/transfers/neuestetransfers/statistik?ajax=1&altersklasse=&ausrichtung=&land_id=&spielerposition_id=&filter=&transferfenster=sommer&jahrgang=&outgoing=&verein_id=&cont=&yt0=Show";

    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json"
        }
    });

    const data = await res.json();

    // data contains a table with transfer info
    const transfers = data.transfers || [];

    const cleaned = transfers.map(t => ({
        player: t.spielerName || "Unknown",
        to: t.ziel_name || "Unknown Club",
        fee: t.abloese || "N/A"
    }));

    return cleaned.slice(0, 10);
}


    return results.slice(0, 10);
}

// ------------- SIMPLE EMBED -------------
function makeEmbed(transfers) {
    const embed = new EmbedBuilder()
        .setColor("#00FFFF")
        .setTitle("📢 Last transfer news:")
        .setTimestamp();

    if (transfers.length === 0) {
        embed.addFields({
            name: "No official transfers found",
            value: "Try again later.",
            inline: false
        });
        return embed;
    }

    transfers.forEach(t => {
        embed.addFields({
            name: `${t.player} → ${t.to}`,
            value: `💰 ${t.fee}`,
            inline: false
        });
    });

    return embed;
}


// ------------- AUTO CHECK EVERY 10 MIN -------------
async function autoCheck() {
    try {
        const transfers = await getOfficialTransfers();

        if (JSON.stringify(transfers) !== JSON.stringify(lastTransfers)) {
            const channel = client.channels.cache.get(CHANNEL_ID);
            if (channel) {
                await channel.send({ embeds: [makeEmbed(transfers)] });
            }
            lastTransfers = transfers;
        }
    } catch (err) {
        console.error("Auto-check error:", err);
    }
}

// ------------- BOT READY -------------
client.on("ready", async () => {
    console.log(`Логнат като ${client.user.tag}`);

    await registerCommands();

    autoCheck();
    setInterval(autoCheck, 10 * 60 * 1000); // 10 мин
});

// ------------- HANDLE COMMANDS -------------
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "transfers") {
        const transfers = await getOfficialTransfers();
        await interaction.reply({ embeds: [makeEmbed(transfers)] });
    }
});

// ------------- LOGIN -------------
client.login(TOKEN);

