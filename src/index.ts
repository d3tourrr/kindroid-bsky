import { AtpAgent } from '@atproto/api';
import * as dotenv from 'dotenv';
import { randomInt } from 'crypto';
import readline from 'readline';

const agent = new AtpAgent({ service: 'https://bsky.social' });
  const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const keywords = ["ai", "machine learning", "data science", "blockchain", "crypto", "nft", "web3", "decentralized", "metaverse", "virtual reality"];
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

async function searchAndAnalyze(keywords: string[]) {
  await authenticate();
  await new Promise(resolve => setTimeout(resolve, randomInt(1000, 5000))); // Simulate human interaction

  const analyzedPosts = await searchPostsWithMultipleKeywords(keywords);

  const posts = analyzedPosts.map(post => ({
    post: post,
    text: post.record?.text || 'No text content',
    value: analyzePostInteractionValue(post),
    uri: post.uri,
    cid: post.cid,
    url: `https://bsky.app/profile/${post.author.handle}/post/${post.uri.split('/').pop()}`
  })).sort((a, b) => b.value - a.value);

  return posts.slice(0, maxresults);
}

async function searchPostsWithMultipleKeywords(keywords: string[]): Promise<any[]> {
  let allPosts = [];

  for (const keyword of keywords) {
    const response = await agent.api.app.bsky.feed.searchPosts({ q: keyword, limit: 50 });
    allPosts = allPosts.concat(response.data.posts);
  }

  return Array.from(new Set(allPosts.map(p => p.uri))).map(uri => allPosts.find(p => p.uri === uri));
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

const readLineAsync = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
};

async function interactWithPost(post: any) {
  const actions = ['like', 'repost', 'reply'];
  const action = actions[randomInt(0, actions.length)];

  switch (action) {
    case 'like':
      console.log('Liking post:', post.url);
      console.log('Text:', post.text);
      await agent.like(post.uri, post.cid);
      break;
    case 'repost':
      console.log('Reposting:', post.url);
      console.log('Text:', post.text);
      await agent.repost(post.uri, post.cid);
      break;
    case 'reply':
      console.log('Replying to post:', post.url);
      console.log('Text:', post.text);

      try {
        const replyObject = {
          root: {uri: post.uri, cid: post.cid},
          parent: {uri: post.uri, cid: post.cid},
        };
        await agent.post({
          text: await readLineAsync('Enter reply text: '),
          reply: replyObject
        });
        console.log('Replied to post:', post.url);
      } catch (error) {
        console.error('Failed to reply to post:', error);
      }
      break;
  }
}

async function createNewPost() {
  return new Promise<string>((resolve) => {
    rl.question('Enter new post content: ', (content) => {
      resolve(content);
    });
  });
}

async function simulateHumanSearch(index: number) {
  console.log(`Starting search session at ${new Date().toLocaleTimeString()}`);
  const topPosts = await searchAndAnalyze(keywords.slice(index * 2, (index * 2) + 2));

  for (let i = 0; i < topPosts.length; i++) {
    const post = topPosts[i];
    await new Promise(resolve => setTimeout(resolve, randomInt(500, 2000))); // Simulate human interaction
    await interactWithPost(post);
  }

  const newPostContent = await createNewPost();
  await agent.post({ text: newPostContent });
  console.log('Posted:', newPostContent);
}

async function main() {
  dotenv.config();

  try {
    await simulateHumanSearch(0);
    await simulateHumanSearch(1);
  } catch (error) {
    console.error('Failed to fetch or analyze posts:', error);
  }
}

main().catch(console.error);

