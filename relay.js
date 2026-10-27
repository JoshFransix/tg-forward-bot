require("dotenv").config();
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");

const apiId = parseInt(process.env.API_ID, 10);
const apiHash = process.env.API_HASH;
const SOURCE = BigInt(process.env.SOURCE_GROUP);
const TARGET = BigInt(process.env.TARGET_GROUP);

const SESSION_FILE = "session.txt";
const sessionString = fs.existsSync(SESSION_FILE)
  ? fs.readFileSync(SESSION_FILE, "utf8").trim()
  : "";

// Throttle: minimum gap between reposts, to stay well under Telegram limits
const MIN_GAP_MS = 3000;
let lastSent = 0;
let queue = Promise.resolve();

(async () => {
  const client = new TelegramClient(
    new StringSession(sessionString),
    apiId,
    apiHash,
    {
      connectionRetries: 5,
      // WebSocket over 443 tends to be more stable than raw TCP on port 80
      useWSS: true,
      autoReconnect: true,
    },
  );

  await client.start({
    phoneNumber: async () =>
      await input.text("Phone number (+countrycode...): "),
    password: async () => await input.text("2FA password (if enabled): "),
    phoneCode: async () => await input.text("Login code from Telegram: "),
    onError: (err) => console.error(err),
  });

  fs.writeFileSync(SESSION_FILE, client.session.save());

  // Cache chats so numeric group IDs can be resolved when forwarding
  await client.getDialogs({});
  console.log("Logged in. Listening for new messages in source group...");

  client.addEventHandler(async (event) => {
    const message = event.message;
    if (!message) return;
    if (message.chatId === undefined) return;

    // Compare by the peer's raw id so the -100 prefix is handled consistently
    const chatId = BigInt(message.chatId.toString());
    if (chatId !== SOURCE && chatId !== -SOURCE - 1000000000000n) return;

    // My source channel has "Restrict saving content" enabled, so forwarding is
    // blocked; posts are sent as new messages instead. Media can't be re-sent
    // from a protected chat, so only its caption is reposted.
    const text = message.message;
    if (!text) {
      console.log(`Skipped message ${message.id} (no text)`);
      return;
    }

    // Calls are reduced to just the contract address (Solana base58 string,
    // 32-44 chars), preferring one ending in "pump" and falling back to the
    // first match; anything else, like pump updates, is sent as-is
    const matches = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g) ?? [];
    const ca = matches.find((m) => m.endsWith("pump")) ?? matches[0];
    const outgoing = ca
      ? { message: ca }
      : { message: text, formattingEntities: message.entities };

    // Chain sends so bursts of messages are spaced out one after another
    queue = queue.then(async () => {
      const wait = MIN_GAP_MS - (Date.now() - lastSent);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      lastSent = Date.now();

      try {
        await client.sendMessage(TARGET, { ...outgoing, linkPreview: false });
        console.log(
          ca ? `Sent CA ${ca} from message ${message.id}` : `Sent message ${message.id}`,
        );
      } catch (err) {
        console.error("Copy failed:", err.message);
      }
    });
  }, new (require("telegram/events").NewMessage)({}));
})();
