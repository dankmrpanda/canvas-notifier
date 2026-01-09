/**
 * Shared Utility Helpers
 * Common utility functions used across multiple modules
 */

/**
 * Delay/sleep helper for rate limiting
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get channel with fallback to fetch if not in cache
 * @param {Client} client - Discord client
 * @param {string} channelId - Channel ID
 * @returns {Promise<import('discord.js').Channel|null>} Channel or null
 */
export async function getChannel(client, channelId) {
    if (!channelId) return null;

    let channel = client.channels.cache.get(channelId);

    if (!channel) {
        try {
            channel = await client.channels.fetch(channelId);
        } catch {
            return null;
        }
    }

    return channel;
}
