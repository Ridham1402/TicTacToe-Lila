/**
 * nakamaClient.ts — Singleton Nakama JS client and socket configuration.
 *
 * Reads connection settings from Vite env vars:
 *   VITE_NAKAMA_HOST       — hostname only, e.g. "my-nakama.onrender.com"
 *   VITE_NAKAMA_PORT       — default 7350 (local) or 443 (Render HTTPS)
 *   VITE_NAKAMA_USE_SSL    — "true" for Render, "false" for local dev
 *
 * Usage:
 *   import { client } from "@/lib/nakamaClient";
 *   const session = await client.authenticateDevice(deviceId, true, username);
 */

import { Client } from "@heroiclabs/nakama-js";

// ---------------------------------------------------------------------------
// Connection config (from env vars, with local dev defaults)
// ---------------------------------------------------------------------------

const HOST = import.meta.env.VITE_NAKAMA_HOST ?? "localhost";
const PORT = Number(import.meta.env.VITE_NAKAMA_PORT ?? 7350);
const USE_SSL = import.meta.env.VITE_NAKAMA_USE_SSL === "true";

// Nakama server key — must match nakama/local.yml socket.server_key
const SERVER_KEY = "defaultkey";

// ---------------------------------------------------------------------------
// Singleton client instance
// ---------------------------------------------------------------------------

/**
 * Nakama HTTP/REST client.
 * One client per app — shared across all hooks.
 */
export const client = new Client(SERVER_KEY, HOST, String(PORT), USE_SSL);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a stable device ID for anonymous authentication.
 * Stored in localStorage so the same user gets the same account
 * across sessions on the same device.
 */
export function getOrCreateDeviceId(): string {
    const STORAGE_KEY = "nakama_device_id";
    let deviceId = localStorage.getItem(STORAGE_KEY);
    if (!deviceId) {
        // Generate a UUID-like random string
        deviceId = "device-" + Math.random().toString(36).substring(2) + "-" + Date.now().toString(36);
        localStorage.setItem(STORAGE_KEY, deviceId);
    }
    return deviceId;
}

/**
 * Returns the stored username or null if not yet set.
 */
export function getStoredUsername(): string | null {
    return localStorage.getItem("nakama_username");
}

/**
 * Persist the chosen username.
 */
export function setStoredUsername(username: string): void {
    localStorage.setItem("nakama_username", username);
}
