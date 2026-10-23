# TODO

## Move `@dwk@📟.dwk.io` → `@dwk@dwk.io`

The Mastodon account at `xn--4t8h.dwk.io` moves to the self-hosted
`@dwk/activitypub` actor at [`/users/dwk`](https://dwk.io/users/dwk)
([Mastodon: moving](https://docs.joinmastodon.org/user/moving/)). A `Move`
redirects followers but not the accounts the old one follows, posts, or lists.

Ready:

- [x] `acct:dwk@dwk.io` resolves to `/users/dwk`, whose `alsoKnownAs` names
      `https://xn--4t8h.dwk.io/users/dwk` (#68)
- [x] Signed outbound fetches, so follows from authorized-fetch servers such as
      mastodon.social verify ([workers#545](https://github.com/davidwkeith/workers/pull/545), #76)
- [x] A follow from mastodon.social (`@dwk_test`) and one from the 📟 account
      both landed in [`/users/dwk/followers`](https://dwk.io/users/dwk/followers?page=1)
- [x] `scripts/refollow.mjs` to replay the Follows export (#77)

Move:

- [ ] Export from the 📟 account (Preferences → Import and export → Data
      export): Follows CSV, plus lists, mutes, blocks, bookmarks and the
      archive, none of which move; keep them out of the repo (`.gitignore`
      covers `following_accounts*.csv` and the script's `*.sent.json`)
- [ ] Start the move from the 📟 account (Account → Move to a different
      account) to `@dwk@dwk.io`
- [ ] `ACTIVITYPUB_PUBLISH_TOKEN=… node scripts/refollow.mjs following_accounts.csv --dry-run`,
      then without `--dry-run`
- [ ] A day or so later, rerun it to see which follows were accepted;
      `--resend` for the rest
- [ ] Keep the 📟 instance running: followers' servers re-check the old
      account, and `refollow.mjs` falls back to its lookup API
- [ ] Unfollow from `@dwk_test` on mastodon.social, or keep it as a test
      account

Gaps in `@dwk/activitypub` the move exposes:

- [ ] Profile fields (`attachment`) and a header image: the Me / Blog /
      Gravatar / Keybase fields and the banner don't carry over
- [ ] Two `@dwk/safe-fetch` versions in the tree (beta.1 top-level, beta.2
      under `@dwk/activitypub`): line them up on the next `@dwk` bump
