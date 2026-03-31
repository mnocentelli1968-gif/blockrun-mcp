// src/tools/x.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getClient } from "../utils/wallet.js";
import { formatError } from "../utils/errors.js";

export function registerXTool(server: McpServer): void {
  server.registerTool(
    "blockrun_x",
    {
      description: `Full X/Twitter API powered by AttentionVC. Real-time data on users, tweets, trends, and analytics.

Actions & pricing:
- user_lookup: Batch profile lookup by usernames ($0.002/user)
- user_info: Detailed profile for one user ($0.002)
- user_tweets: Posts by a user ($0.032/page)
- user_mentions: Tweets mentioning a user ($0.032/page)
- user_followers: Follower list ($0.05/page)
- tweet_lookup: Fetch full tweet data by ID(s) ($0.16/batch)
- tweet_replies: Replies to a tweet ($0.032/page)
- tweet_thread: Full thread context for a tweet ($0.032/page)
- search: Advanced search with Twitter operators ($0.032/page)
- trending: Current trending topics ($0.002)
- articles_rising: Rising/viral articles ($0.05)
- author_analytics: Author intelligence metrics ($0.02)
- compare_authors: Side-by-side author comparison ($0.05)

Note: For real-time Grok search, use blockrun_twitter instead.`,
      inputSchema: {
        action: z.enum([
          "user_lookup", "user_info", "user_tweets", "user_mentions",
          "user_followers", "tweet_lookup", "tweet_replies", "tweet_thread",
          "search", "trending", "articles_rising", "author_analytics", "compare_authors",
        ]).describe("Action to perform"),
        username: z.string().optional().describe("X/Twitter username without @ (for user_* and author_analytics/compare_authors)"),
        usernames: z.array(z.string()).optional().describe("Multiple usernames for user_lookup batch"),
        tweet_id: z.string().optional().describe("Tweet ID (for tweet_replies, tweet_thread)"),
        tweet_ids: z.array(z.string()).optional().describe("Multiple tweet IDs for tweet_lookup batch"),
        query: z.string().optional().describe("Search query with optional Twitter operators (for search)"),
        handle2: z.string().optional().describe("Second username for compare_authors"),
        query_type: z.enum(["Latest", "Top", "Default"]).optional().describe("Sort order for search/replies (default: Latest)"),
        include_replies: z.boolean().optional().describe("Include reply tweets in user_tweets (default: false)"),
        cursor: z.string().optional().describe("Pagination cursor from previous response"),
      },
    },
    async ({ action, username, usernames, tweet_id, tweet_ids, query, handle2, query_type, include_replies, cursor }) => {
      try {
        const llm = getClient();
        let result;

        switch (action) {
          case "user_lookup":
            result = await llm.xUserLookup(usernames ?? username ?? "");
            break;
          case "user_info":
            if (!username) throw new Error("username required");
            result = await llm.xUserInfo(username);
            break;
          case "user_tweets":
            if (!username) throw new Error("username required");
            result = await llm.xUserTweets(username, include_replies ?? false, cursor);
            break;
          case "user_mentions":
            if (!username) throw new Error("username required");
            result = await llm.xUserMentions(username, undefined, undefined, cursor);
            break;
          case "user_followers":
            if (!username) throw new Error("username required");
            result = await llm.xFollowers(username, cursor);
            break;
          case "tweet_lookup":
            if (!tweet_ids && !tweet_id) throw new Error("tweet_id or tweet_ids required");
            result = await llm.xTweetLookup(tweet_ids ?? tweet_id ?? "");
            break;
          case "tweet_replies":
            if (!tweet_id) throw new Error("tweet_id required");
            result = await llm.xTweetReplies(tweet_id, query_type ?? "Latest", cursor);
            break;
          case "tweet_thread":
            if (!tweet_id) throw new Error("tweet_id required");
            result = await llm.xTweetThread(tweet_id, cursor);
            break;
          case "search":
            if (!query) throw new Error("query required");
            result = await llm.xSearch(query, query_type ?? "Latest", cursor);
            break;
          case "trending":
            result = await llm.xTrending();
            break;
          case "articles_rising":
            result = await llm.xArticlesRising();
            break;
          case "author_analytics":
            if (!username) throw new Error("username required");
            result = await llm.xAuthorAnalytics(username);
            break;
          case "compare_authors":
            if (!username || !handle2) throw new Error("username and handle2 both required");
            result = await llm.xCompareAuthors(username, handle2);
            break;
          default:
            throw new Error(`Unknown action: ${action}`);
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: result as unknown as Record<string, unknown>,
        };
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: formatError(errMsg) }],
          isError: true,
        };
      }
    }
  );
}
