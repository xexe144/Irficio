import fetch from "node-fetch";
import * as cheerio from "cheerio";
import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  EmbedBuilder
} from "discord.js";

const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
});

// ---------------------------
//  REGISTER SLASH COMMANDS
// ---------------------------

const commands = [
  {
    name: "transfers",
    description: "Show official transfers from top leagues"
  },
  {
    name: "rumours",
    description: "Show transfer rumours from TeamTalk"
  }
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function register() {
  try {
    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands
    });
    console.log("Slash commands registered.");
  } catch (e) {
    console.log("Error registering commands:", e);
  }
}

// -------------------------------------------------------
//   OFFICIAL TRANSFER SCRAPER (GOAL)
// -------------------------------------------------------

async function scrapeOfficialTransfers() {
  let url = "https://www.goal.com/en/transfer-news";
  const html = await (await fetch(url)).text();
  const $ = cheerio.load(html);

  let results = [];

  $(".type-article").each((i, el) => {
    const title = $(el).find("h3").text().trim();
    if (!title) return;

    // включваме само официални
    if (
      title.toLowerCase().includes("official") ||
      title.toLowerCase().includes("confirmed")
    ) {
      results.push(title);
    }
  });

  return results.slice(0, 10);
}

// -------------------------------------------------------
//   RUMOURS SCRAPER (TEAMTALK — стабилен)
// -------------------------------------------------------

async function scrapeRumours() {
  const url = "https://www.teamtalk.com/transfer-news";
  const html = await (await fetch(url)).text();
  const $ = cheerio.load(html);

  let rumours = [];

  $(".articleCard").each((i, el) => {
    const title = $(el).find(".articleCard__title").text().trim();
    if (title) rumours.push(title);
  });

  return rumours.slice(0, 10);
}

// -------------------------------------------------------
//   SLASH COMMANDS HANDLER
// -------------------------------------------------------

client.on("interactionCreate", async (i) => {
  if (!i.isChatInputCommand()) return;

  if (i.commandName === "transfers") {
    await i.deferReply();

    const transfers = await scrapeOfficialTransfers();

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Official Transfers")
      .setTimestamp();

    if (transfers.length === 0) {
      embed.setDescription("No official transfers\nTry again later.");
    } else {
      embed.setDescription(transfers.map((t) => `• ${t}`).join("\n"));
    }

    i.editReply({ embeds: [embed] });
  }

  if (i.commandName === "rumours") {
    await i.deferReply();

    const rumours = await scrapeRumours();

    const embed = new EmbedBuilder()
      .setColor("Yellow")
      .setTitle("🟡 Transfer Rumours (TeamTalk)")
      .setTimestamp();

    if (rumours.length === 0) {
      embed.setDescription("No rumours\nTry again later.");
    } else {
      embed.setDescription(rumours.map((r) => `• ${r}`).join("\n"));
    }

    i.editReply({ embeds: [embed] });
  }
});

// -------------------------------------------------------
//   AUTO-CHECK EVERY 10 MINUTES — само официални!
// -------------------------------------------------------

setInterval(async () => {
  const transfers = await scrapeOfficialTransfers();

  if (transfers.length === 0) return;

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setTitle("📢 NEW Official Transfer Detected!")
    .setDescription(transfers.map((t) => `• ${t}`).join("\n"))
    .setTimestamp();

  const channel = client.channels.cache.get(CHANNEL_ID);
  if (channel) channel.send({ embeds: [embed] });
}, 10 * 60 * 1000); // 10 минути

// -------------------------------------------------------

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await register();
});

client.login(TOKEN);

