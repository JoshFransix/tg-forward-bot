# tg-relay

Relays new posts from a source Telegram channel/group to a target group, using
your own Telegram account (via [GramJS](https://github.com/gram-js/gramjs)).

Because the source channel has "Restrict saving content" enabled, posts are
sent as new messages rather than forwarded. Messages containing a Solana
contract address are reduced to just the address (preferring one ending in
`pump`); other text is sent as-is. Media without a caption is skipped.

## Setup

### 1. Configure `.env`

Create a `.env` file in this folder:

```env
API_ID=1234567
API_HASH=0123456789abcdef0123456789abcdef
SOURCE_GROUP=-1001234567890
TARGET_GROUP=-1009876543210
```

- `API_ID` / `API_HASH`: create an app at <https://my.telegram.org> → API development tools.
- `SOURCE_GROUP`: ID of the channel/group to read from.
- `TARGET_GROUP`: ID of the group to send to.

Your account must be a member of both chats.

### 2. Install dependencies

```sh
npm install
```

### 3. First run and login

```sh
node relay.js
```

On the first run you'll be prompted for:

1. Your phone number (with country code, e.g. `+15551234567`)
2. The login code Telegram sends you
3. Your 2FA password, if enabled

After logging in, the session is saved to `session.txt`, so later runs start
without prompting. Delete `session.txt` to log in again.

## Keep `session.txt` private

`session.txt` grants full access to your Telegram account. Never commit it,
share it, or upload it anywhere. It's already listed in `.gitignore`, along
with `.env`. If it ever leaks, terminate the session in Telegram under
Settings → Devices.
