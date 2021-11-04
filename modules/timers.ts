import {MessageAttachment, MessageEmbed} from "discord.js";
import Schedule from "node-schedule";
import {isHoliday} from "nyse-holidays";
import {getAssetByName} from "./assets";
import {getFromDracoon} from "./dracoon-downloader";
import {readSecret} from "./secrets";

export function startTimers(client, channelID: string) {
  const ruleNYSEPremarketOpen = new Schedule.RecurrenceRule();
  ruleNYSEPremarketOpen.hour = 4;
  ruleNYSEPremarketOpen.minute = 0;
  ruleNYSEPremarketOpen.dayOfWeek = [0, new Schedule.Range(1, 5)];
  ruleNYSEPremarketOpen.tz = "US/Eastern";

  const ruleNYSEOpen = new Schedule.RecurrenceRule();
  ruleNYSEOpen.hour = 9;
  ruleNYSEOpen.minute = 30;
  ruleNYSEOpen.dayOfWeek = [0, new Schedule.Range(1, 5)];
  ruleNYSEOpen.tz = "US/Eastern";

  const ruleNYSEClose = new Schedule.RecurrenceRule();
  ruleNYSEClose.hour = 16;
  ruleNYSEClose.minute = 0;
  ruleNYSEOpen.dayOfWeek = [0, new Schedule.Range(1, 5)];
  ruleNYSEClose.tz = "US/Eastern";

  const ruleNYSEAftermarketClose = new Schedule.RecurrenceRule();
  ruleNYSEAftermarketClose.hour = 20;
  ruleNYSEAftermarketClose.minute = 0;
  ruleNYSEAftermarketClose.dayOfWeek = [0, new Schedule.Range(1, 5)];
  ruleNYSEAftermarketClose.tz = "US/Eastern";

  const ruleFriday = new Schedule.RecurrenceRule();
  ruleFriday.hour = 9;
  ruleFriday.minute = 0;
  ruleFriday.dayOfWeek = [5];
  ruleFriday.tz = "Europe/Berlin";

  const jobNYSEPremarketOpen = Schedule.scheduleJob(ruleNYSEPremarketOpen, () => {
    if (false === isHoliday(new Date())) {
      console.log(`${new Date()} NYSE Premarket Open`);
      client.channels.cache.get(channelID).send(`${new Date()} NYSE Premarket Open`);
    } else {
      console.log(`${new Date()} NYSE Holiday`);
      client.channels.cache.get(channelID).send(`${new Date()} NYSE Holiday`).catch(console.error);
    }
  });

  const jobNYSEOpen = Schedule.scheduleJob(ruleNYSEOpen, () => {
    if (false === isHoliday(new Date())) {
      console.log(`${new Date()} NYSE Open`);
      client.channels.cache.get(channelID).send(`${new Date()} NYSE Open`).catch(console.error);
    }
  });

  const jobNYSEClose = Schedule.scheduleJob(ruleNYSEClose, () => {
    if (false === isHoliday(new Date())) {
      console.log(`${new Date()} NYSE Close`);
      client.channels.cache.get(channelID).send(`${new Date()} NYSE Close`).catch(console.error);
    }
  });

  const jobNYSEAftermarketClose = Schedule.scheduleJob(ruleNYSEAftermarketClose, () => {
    if (false === isHoliday(new Date())) {
      console.log(`${new Date()} NYSE Aftermarket Close`);
      client.channels.cache.get(channelID).send(`${new Date()} NYSE Aftermarket Close`).catch(console.error);
    }
  });

  const jobFriday = Schedule.scheduleJob(ruleFriday, () => {
    getFromDracoon(readSecret("dracoon_password"), getAssetByName("freitag").getLocationId(), buffer => {
      const fridayFile = new MessageAttachment(buffer, getAssetByName("freitag").getFileName());
      const fridayEmbed = new MessageEmbed();
      fridayEmbed.setImage(`attachment://${getAssetByName("freitag").getFileName()}`);
      client.channels.cache.get(channelID).send({embeds: [fridayEmbed], files: [fridayFile]}).catch(console.error);
    });
  });
}
