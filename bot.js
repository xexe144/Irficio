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
    const url = "https://rsshub.app/twitter/user/FabrizioRomano";

    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0"
        }
    });

    const data = await res.json();

    const tweets = data.items || [];

    // Filter ONLY official transfers
    const officialTweets = tweets.filter(t =>
        t.title.includes("Here we go") ||
        t.title.includes("Official") ||
        t.title.includes("confirmed") ||
        t.title.includes("Completed") ||
        t.title.includes("Deal") ||
        t.title.includes("joins") ||
        t.title.includes("signs")
    );

    // Clean text
    const cleaned = officialTweets.slice(0, 10).map(t => ({
        player: t.title.replace(/<[^>]+>/g, "").trim(),
        to: "",
        fee: ""
    }));

    return cleaned;
}



// ------------- SIMPLE EMBED -------------
function makeEmbed(transfers) {
    const embed = new EmbedBuilder()
        .setColor("#00FFFF")
        .setTitle("📢 HERE WE GO!:")
        .setTimestamp();

    if (transfers.length === 0) {
        embed.addFields({
            name: "No official transfers yet",
            value: "Try again later.",
            inline: false
        });
        return embed;
    }

    transfers.forEach(t => {
        embed.addFields({
            name: " ",
            value: `• ${t.player}`,
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



