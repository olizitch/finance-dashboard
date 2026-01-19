import fs from "node:fs/promises";

const STOCKS = [
  "NVDA.US","AAPL.US","MSFT.US","GOOG.US","GOOGL.US","AMZN.US","META.US","AVGO.US","TSM.US","ORCL.US",
  "AMD.US","ASML.US","SAP.US","CSCO.US","CRM.US","QCOM.US","ADBE.US","INTC.US","TXN.US","PLTR.US",
  "CRWD.US","PYPL.US","SNPS.US","NOW.US","ZS.US","PANW.US","9766.JP","RBLX.US","DOCU.US","NET.US",
  "DDOG.US","OKTA.US","TEAM.US","SNOW.US","FSLR.US","FVRR.US","BBY.US","ETSY.US","ROKU.US","SQ.US",
  "TTD.US","WDAY.US","DUOL.US","UPST.US","ZM.US","ANET.US","ARM.US"
];

const COINS = {
  bitcoin: "BTC",
  ethereum: "ETH",
  tether: "USDT",
  binancecoin: "BNB",
  ripple: "XRP",
  "usd-coin": "USDC",
  solana: "SOL",
  tron: "TRX",
  dogecoin: "DOGE",
  cardano: "ADA"
};

// --- helpers ---
function parseCsvLine(line) {
  // simple CSV split (Stooq lines are simple, no quoted commas in our fields)
  return line.split(",").map(s => s.trim());
}

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.json();
}

// --- data sources ---
async function getStocksFromStooq(symbols) {
  // Stooq quote CSV endpoint example: q/l with e=csv 
  // We'll fetch one-by-one (47 symbols = 47 requests/day, that's fine).
  const out = [];
  for (const sym of symbols) {
    const s = sym.toLowerCase();
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(s)}&f=sd2t2ohlcv&h&e=csv`;
    const csv = await fetchText(url);
    const lines = csv.trim().split("\n");
    if (lines.length < 2) continue;

    const header = parseCsvLine(lines[0]);
    const row = parseCsvLine(lines[1]);

    const obj = Object.fromEntries(header.map((k, i) => [k, row[i]]));
    // Fields include Symbol, Date, Time, Open, High, Low, Close, Volume 
    out.push({
      symbol: obj.Symbol,
      date: obj.Date,
      time: obj.Time,
      open: Number(obj.Open),
      high: Number(obj.High),
      low: Number(obj.Low),
      close: Number(obj.Close),
      volume: Number(obj.Volume)
    });
  }
  return out;
}

async function getFxFromNBU() {
  // NBU endpoint returns rates in UAH per 1 unit of currency; supports JSON :contentReference[oaicite:8]{index=8}
  const url = "https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json";
  const data = await fetchJson(url);

  const pick = (cc) => data.find(x => x.cc === cc);
  const usd = pick("USD");
  const eur = pick("EUR");
  const gbp = pick("GBP");
  if (!usd || !eur || !gbp) throw new Error("NBU: missing USD/EUR/GBP in response");

  const USD_UAH = usd.rate;
  const EUR_UAH = eur.rate;
  const GBP_UAH = gbp.rate;

  return {
    date: usd.exchangedate,
    uah: { USD: USD_UAH, EUR: EUR_UAH, GBP: GBP_UAH },
    usd: { EUR: USD_UAH / EUR_UAH, GBP: USD_UAH / GBP_UAH },
    usd_uah: USD_UAH
  };
}

async function getCryptoFromCoinGecko() {
  // CoinGecko simple price by IDs :contentReference[oaicite:9]{index=9}
  const ids = Object.keys(COINS).join(",");
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd,uah`;
  const data = await fetchJson(url);

  const usd = {};
  const uah = {};
  for (const [id, ticker] of Object.entries(COINS)) {
    usd[ticker] = data[id]?.usd ?? null;
    uah[ticker] = data[id]?.uah ?? null;
  }
  return { usd, uah };
}

// --- main ---
async function run() {
  const [stocks, fx, crypto] = await Promise.all([
    getStocksFromStooq(STOCKS),
    getFxFromNBU(),
    getCryptoFromCoinGecko()
  ]);

  const dashboard = {
    updatedAt: new Date().toISOString(),
    fx: {
      date: fx.date,
      uah: fx.uah,
      usd: fx.usd
    },
    crypto,
    stocks
  };

  await fs.writeFile("public/dashboard.json", JSON.stringify(dashboard, null, 2), "utf8");
  console.log("Updated public/dashboard.json");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
