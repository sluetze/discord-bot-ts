// Dependencies
import {Client, Intents, MessageAttachment, MessageEmbed} from "discord.js";
import {REST} from "@discordjs/rest";
import {quote, SlashCommandBuilder} from "@discordjs/builders";
import {Routes} from "discord-api-types/v9";
import {UserQuoteAsset, User, EmojiAsset, ImageAsset, TextAsset, getAssets} from "./modules/assets";
import {readSecret} from "./modules/secrets";
import {getFromDracoon} from "./modules/dracoon-downloader";
import {runHealthCheck} from "./modules/healthcheck";
import {startTimers} from "./modules/timers";

const token = readSecret("discord_token");
const clientId = readSecret("discord_clientID");
const guildId = readSecret("discord_guildID");

runHealthCheck();
const assets = [...getAssets("image"), ...getAssets("text"), ...getAssets("emoji"), ...getAssets("user"), ...getAssets("userquote")];

const assetCommands = [];
const assetCommandsWithPrefix = [];
for (const asset of assets) {
  for (const trigger of asset.getTrigger()) {
    assetCommands.push(trigger.replaceAll(" ", "_"));
    assetCommandsWithPrefix.push(`!${trigger}`);
  }
}

console.log(`Successfully loaded ${assets.length} assets.`);

// Create a new client instance
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  ],
});

startTimers(client, readSecret("hblwrk_NYSEOpenCloseAnnouncement_ChannelID"));
console.log("Successfully set timers.");

// Some samples
// Message response to a message including with a trigger word
client.on("messageCreate", message => {
  // Triggers without prefix
  if (assetCommands.some(v => message.content.toLowerCase().includes(v))) {
    for (const asset of assets) {
      for (const trigger of asset.getTrigger()) {
        const triggerRex = new RegExp(`\\b${trigger}\\b`);
        if (triggerRex.test(message.content.toLowerCase())) {
          if (asset instanceof EmojiAsset) {
            // Emoji reaction to a message
            for (const response of asset.getResponse()) {
              if (response.startsWith("custom:")) {
                const reactionEmoji = message.guild.emojis.cache.find(emoji => emoji.name === response.replace("custom:", ""));
                message.react(reactionEmoji).catch(console.error);
              } else {
                message.react(response).catch(console.error);
              }
            }
          }
        }
      }
    }
  }

  // Triggers with prefix (!command)
  if (assetCommandsWithPrefix.some(v => message.content.includes(v))) {
    for (const asset of assets) {
      if (message.content.includes(asset.getTrigger())) {
        if (asset instanceof ImageAsset || asset instanceof UserQuoteAsset) {
          // Response with an image
          getFromDracoon(readSecret("dracoon_password"), asset.getLocationId(), buffer => {
            const file = new MessageAttachment(buffer, asset.getFileName());
            const embed = new MessageEmbed();
            embed.setTitle(asset.getTitle());
            embed.setAuthor(client.user.username);
            embed.setImage(`attachment://${asset.getFileName()}`);
            message.channel.send({embeds: [embed], files: [file]}).catch(console.error);
          });
        } else if (asset instanceof TextAsset) {
          // Simple response to a message
          message.channel.send(asset.getResponse()).catch(console.error);
        }
      }
    }
  }
});

// Slash Commands
// Define slash-command
const slashCommands = [];
for (const asset of assets) {
  if (asset instanceof ImageAsset || asset instanceof TextAsset || asset instanceof User) {
    const slashCommand = new SlashCommandBuilder()
      .setName(asset.getName().replaceAll(" ", "_"))
      .setDescription(asset.getTitle());
    slashCommands.push(slashCommand.toJSON());
  }
}

// Deploy slash-command to server
const rest = new REST({
  version: "9",
}).setToken(token);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      {
        body: slashCommands,
      },
    );
    console.log("Successfully registered slash commands.");
  } catch (error: unknown) {
    console.error(error);
  }
})();

// Respond to slash-command
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) {
    return;
  }

  if (assetCommands.some(v => interaction.commandName.includes(v))) {
    for (const asset of assets) {
      if (interaction.commandName.includes(asset.getName().replaceAll(" ", "_"))) {
        if (asset instanceof ImageAsset) {
          getFromDracoon(readSecret("dracoon_password"), asset.getLocationId(), async buffer => {
            const file = new MessageAttachment(buffer, asset.getFileName());
            await interaction.reply({files: [file]});
            console.log(`${interaction.user.tag} in #${interaction.channel.id} triggered a slashcommand.`);
          });
        } else if (asset instanceof TextAsset) {
          interaction.reply(asset.getResponse()).catch(console.error);
          console.log(`${interaction.user.tag} in #${interaction.channel.id} triggered a slashcommand.`);
        } else if (asset instanceof User) {
          let randomQuotePool = [];
          for (const quote of assets) {
            if (quote instanceof UserQuoteAsset && quote.getUser() == asset.getName()) {
              randomQuotePool.push(quote);
            }
          }

          let randomQuote = randomQuotePool[Math.floor(Math.random() * randomQuotePool.length)];
          getFromDracoon(readSecret("dracoon_password"), randomQuote.getLocationId(), async buffer => {
            const file = new MessageAttachment(buffer, randomQuote.getFileName());
            await interaction.reply({files: [file]});
            console.log(`${interaction.user.tag} in #${interaction.channel.id} triggered a slashcommand.`);
          });
        }
      }
    }
  }
});

// One-time events, e.g. log-in
const eventReady = {
  name: "ready",
  once: true,
  execute() {
    console.log("Ready and logged in.");
  },
};

client.once(eventReady.name, (...args) => {
  eventReady.execute.apply(null, ...args);
});

// Login to Discord with your client's token
client.login(token).catch(console.error);
