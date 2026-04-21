// src/tools/twitter.ts
//
// Structured X/Twitter tool backed by the dedicated /v1/x/* endpoints
// (AttentionVC partner). Exposes the full endpoint family under one tool
// with an `action` discriminator so it shows up as a single capability
// rather than a dozen near-duplicates.
//
// Replaces the previous chat-search based prototype.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

const ACTION = z.enum([
  "user_lookup",
  "user_info",
  "followers",
  "followings",
  "verified_followers",
  "user_tweets",
  "user_mentions",
  "tweet_lookup",
  "tweet_replies",
  "tweet_thread",
  "search",
]);

export function registerTwitterTool(server: McpServer): void {
  server.registerTool(
    "blockrun_x",
    {
      description: `Structured X/Twitter data via AttentionVC partner API.

Actions:
- user_lookup (usernames: string | string[])
- user_info (username)
- followers (username, cursor?)
- followings (username, cursor?)
- verified_followers (user_id, cursor?)
- user_tweets (username, includeReplies?, cursor?)
- user_mentions (username, sinceTime?, untilTime?, cursor?)
- tweet_lookup (tweet_ids: string | string[])
- tweet_replies (tweet_id, cursor?, queryType?)
- tweet_thread (tweet_id, cursor?)
- search (query, queryType?, cursor?)

Paid per request via x402; prices scale with the endpoint (e.g. user_lookup ~ $0.02, followers ~ $0.05/page).`,
      inputSchema: {
        action: ACTION,
        usernames: z.union([z.string(), z.array(z.string())]).optional(),
        username: z.string().optional(),
        user_id: z.string().optional(),
        tweet_id: z.string().optional(),
        tweet_ids: z.union([z.string(), z.array(z.string())]).optional(),
        query: z.string().optional(),
        queryType: z.enum(["Latest", "Top", "Default"]).optional(),
        cursor: z.string().optional(),
        sinceTime: z.string().optional(),
        untilTime: z.string().optional(),
        includeReplies: z.boolean().optional(),
      },
    },
    async (args) => {
      try {
        const llm = getClient();
        const a = args.action;

        const require = <T>(value: T | undefined, name: string): T => {
          if (value === undefined || value === null || value === "") {
            throw new Error(`${name} is required for action='${a}'`);
          }
          return value;
        };

        let result: unknown;
        switch (a) {
          case "user_lookup":
            result = await llm.xUserLookup(require(args.usernames, "usernames"));
            break;
          case "user_info":
            result = await llm.xUserInfo(require(args.username, "username"));
            break;
          case "followers":
            result = await llm.xFollowers(require(args.username, "username"), args.cursor);
            break;
          case "followings":
            result = await llm.xFollowings(require(args.username, "username"), args.cursor);
            break;
          case "verified_followers":
            result = await llm.xVerifiedFollowers(require(args.user_id, "user_id"), args.cursor);
            break;
          case "user_tweets":
            result = await llm.xUserTweets(
              require(args.username, "username"),
              args.includeReplies,
              args.cursor
            );
            break;
          case "user_mentions":
            result = await llm.xUserMentions(
              require(args.username, "username"),
              args.sinceTime,
              args.untilTime,
              args.cursor
            );
            break;
          case "tweet_lookup":
            result = await llm.xTweetLookup(require(args.tweet_ids, "tweet_ids"));
            break;
          case "tweet_replies":
            result = await llm.xTweetReplies(
              require(args.tweet_id, "tweet_id"),
              args.queryType as "Latest" | "Default" | undefined,
              args.cursor
            );
            break;
          case "tweet_thread":
            result = await llm.xTweetThread(require(args.tweet_id, "tweet_id"), args.cursor);
            break;
          case "search":
            result = await llm.xSearch(require(args.query, "query"), args.queryType, args.cursor);
            break;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as Record<string, unknown>,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: formatError(msg) }],
          isError: true,
        };
      }
    }
  );
}
