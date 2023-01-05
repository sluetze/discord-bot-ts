/* eslint-disable max-depth */
/* eslint-disable complexity */
/* eslint-disable unicorn/prefer-ternary */
/* eslint-disable @typescript-eslint/no-unnecessary-boolean-literal-compare */
/* eslint-disable yoda */
/* eslint-disable import/extensions */
import axios, {type AxiosResponse} from "axios";
import moment from "moment-timezone";
import {getLogger} from "./logging";
import {type Ticker} from "./tickers";

const logger = getLogger();

export async function getEarnings(days: number, date: string, filter: string): Promise<EarningsEvent[]> {
  let dateStamp: string;

  let usEasternTime: moment.Moment = moment.tz("US/Eastern").set({
    // Testing
    /*
    year: 2022,
    month: 1,
    date: 3,
    hour: 9,
    minute: 30,
    second: 0,
    */
  });

  let nyseOpenTime: moment.Moment = moment.tz("US/Eastern").set({
    // Testing
    /*
    year: 2022,
    month: 1,
    date: 3,
    */
    hour: 9,
    minute: 30,
    second: 0,
  });

  let nyseCloseTime: moment.Moment = moment.tz("US/Eastern").set({
    // Testing
    /*
    year: 2022,
    month: 1,
    date: 3,
    */
    hour: 16,
    minute: 0,
    second: 0,
  });

  // During the weekend, use next Monday
  if ((usEasternTime.day() === 6)) {
    usEasternTime = moment(usEasternTime).day(8);
    nyseOpenTime = moment(nyseOpenTime).day(8);
    nyseCloseTime = moment(nyseCloseTime).day(8);
  } else if ((usEasternTime.day() === 0)) {
    usEasternTime = moment(usEasternTime).day(1);
    nyseOpenTime = moment(nyseOpenTime).day(1);
    nyseCloseTime = moment(nyseCloseTime).day(1);
  }

  if (null === days || 0 === days) {
    if ("today" === date || null === date) {
      dateStamp = usEasternTime.format("YYYY-MM-DD");
    } else if ("tomorrow" === date) {
      dateStamp = usEasternTime.add(1, "days").format("YYYY-MM-DD");
    } else {
      dateStamp = moment(date).tz("US/Eastern").format("YYYY-MM-DD");
    }
  } else {
    if (90 < days) {
      days = 90;
    }

    dateStamp = usEasternTime.add(days, "days").format("YYYY-MM-DD");
  }

  let watchlist = "";

  if ("all" !== filter) {
    watchlist = `&watchlist=${filter}`;
  }

  const earningsEvents = [];

  try {
    // https://api.stocktwits.com/api/2/discover/earnings_calendar?date_from=2023-01-05
    const earningsResponse: AxiosResponse = await axios.get(`https://api.stocktwits.com/api/2/discover/earnings_calendar?date_from=${dateStamp}`);

    for (const element in earningsResponse.data.earnings) {
      if (dateStamp === element) {
        const earnings = earningsResponse.data.earnings[element];
        for (const stock of earnings.stocks) {
          if (0 < stock.importance && dateStamp === stock.date) {
            const earningsTime: moment.Moment = moment(`${stock.date}T${stock.time}-05:00`).tz("US/Eastern");
            const earningsEvent = (new EarningsEvent());
            earningsEvent.ticker = stock.symbol;
            earningsEvent.date = stock.date;

            if (true === moment(earningsTime).isBefore(nyseOpenTime)) {
              earningsEvent.when = "before_open";
            } else if (true === moment(earningsTime).isSameOrAfter(nyseCloseTime)) {
              earningsEvent.when = "after_close";
            } else {
              earningsEvent.when = "during_session";
            }
            earningsEvents.push(earningsEvent);
          }
        }
      }
    }
  } catch (error) {
    logger.log(
      "error",
      `Loading earnings failed: ${error}`,
    );
  }

  return earningsEvents;
}

export function getEarningsText(earningsEvents: EarningsEvent[], when: string, tickers: Ticker[]): string {
  let earningsText = "none";

  if (1 < earningsEvents.length) {
    let earningsBeforeOpen = "";
    let earningsDuringSession = "";
    let earningsAfterClose = "";

    // Sort by market cap, descending order
    earningsEvents = earningsEvents.sort((first, second) => 0 - (first.mcap > second.mcap ? 1 : -1));

    for (const earningEvent of earningsEvents) {
      // Highlight index tickers
      for (const ticker of tickers) {
        if (ticker.symbol === earningEvent.ticker) {
          earningEvent.ticker = `**${earningEvent.ticker}**`;
        }
      }

      switch (earningEvent.when) {
        case "before_open": {
          earningsBeforeOpen += `${earningEvent.ticker}, `;
          break;
        }

        case "during_session": {
          earningsDuringSession += `${earningEvent.ticker}, `;
          break;
        }

        case "after_close": {
          earningsAfterClose += `${earningEvent.ticker}, `;
          break;
        }
      // No default
      }
    }

    moment.locale("de");
    const friendlyDate = moment(earningsEvents[0].date).format("dddd, Do MMMM YYYY");

    earningsText = `Earnings am ${friendlyDate}:\n`;
    if (1 < earningsBeforeOpen.length && ("all" === when || "before_open" === when)) {
      earningsText += `**Vor open:**\n${earningsBeforeOpen.slice(0, -2)}\n\n`;
    }

    if (1 < earningsDuringSession.length && ("all" === when || "during_session" === when)) {
      earningsText += `**Während der Handelszeiten:**\n${earningsDuringSession.slice(0, -2)}\n\n`;
    }

    if (1 < earningsAfterClose.length && ("all" === when || "after_close" === when)) {
      earningsText += `**Nach close:**\n${earningsAfterClose.slice(0, -2)}`;
    }
  }

  return earningsText;
}

class EarningsEvent {
  private _ticker: string;
  private _when: string;
  private _date: string;
  private _mcap: number;

  public get ticker() {
    return this._ticker;
  }

  public set ticker(ticker: string) {
    this._ticker = ticker;
  }

  public get when() {
    return this._when;
  }

  public set when(when: string) {
    this._when = when;
  }

  public get date() {
    return this._date;
  }

  public set date(date: string) {
    this._date = date;
  }

  public get mcap() {
    return this._mcap;
  }

  public set mcap(mcap: number) {
    this._mcap = mcap;
  }
}
