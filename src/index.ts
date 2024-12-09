import { AtpAgent } from '@atproto/api';
import {AppBskyFeedPost } from '@atproto/api';
import * as dotenv from 'dotenv';

const agent = new AtpAgent({ service: 'https://bsky.social' });
const searchFor = "ai";
const maxresults = 5;

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is not set`);
  }
  return value;
}

async function authenticate() {
  await agent.login({ identifier: getEnvVar("BSKY_HANDLE"), password: getEnvVar("BSKY_TOKEN") });
}

async function fetchPostsByKeyword(keyword: string) {
  await authenticate();
  const response = await agent.api.app.bsky.feed.searchPosts({ q: keyword, sort: "top", limit: maxresults });
  return response.data.posts;
}

function analyzePostInteractionValue(post: any): number {
  const likes = post.likeCount || 0;
  const replies = post.replyCount || 0;
  const reposts = post.repostCount || 0;
  const views = post.viewCount || 1; // Avoid division by zero
  
  const engagementRate = (likes + replies + reposts) / views;

  const authorFollowers = post.author?.followersCount || 0;
  // Use log to reduce the impact of very large follower counts (bias correction)
  const authorInfluence = Math.log(1 + authorFollowers);

  const now = new Date();
  const postDate = new Date(post.indexedAt);
  const recencyScore = 1 - (now.getTime() - postDate.getTime()) / (1000 * 60 * 60 * 24 * 30); // Score decreases over 30 days

  return (
    (likes * 2) + 
    replies + 
    (reposts * 1.5) + 
    (engagementRate * 100) +
    authorInfluence + 
    (recencyScore * 100)
  );
}

async function main(keyword: string) {
  dotenv.config();

  try {
    const posts = await fetchPostsByKeyword(keyword);
    const analyzedPosts = posts.map(post => ({
      post: post,
      text: (post.record as AppBskyFeedPost.Record).text || 'No text content',
      engagementScore: analyzePostInteractionValue(post),
      author: post.author.displayName + " | @" + post.author.handle,
      likeCount: post.likeCount,
      repostCount: post.repostCount,
      replyCount: post.replyCount,
      url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
    })).sort((a, b) => b.engagementScore- a.engagementScore);

    const topPosts = analyzedPosts.slice(0, maxresults);
    console.log('Top valuable posts:', topPosts.map(p => ({
      text: (p.post.record as AppBskyFeedPost.Record).text,
      engagementScore: p.engagementScore,
      author: p.author,
      engagements: "Likes: " + p.likeCount + " | Reposts: " + p.repostCount + " | Replies: " + p.replyCount,
      uri: p.url
    })));
  } catch (error) {
    console.error('Failed to fetch or analyze posts:', error);
  }
}

console.log('Analyzing posts...');
console.log('Keyword: ', searchFor);
console.log('Limit: ', maxresults);
main(searchFor).catch(console.error);
console.log('Done.');
