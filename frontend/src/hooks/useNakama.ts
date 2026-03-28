/**
 * useNakama.ts — Authentication and WebSocket lifecycle hook.
 *
 * Responsibilities:
 *  - Authenticate via device ID (anonymous auth, creates account on first call)
 *  - Connect WebSocket socket
 *  - Expose { session, socket, isConnected, userId, username }
 *  - Auto-reconnect on socket close
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Session, Socket } from "@heroiclabs/nakama-js";
import {
    client,
    getOrCreateDeviceId,
    getStoredUsername,
} from "../lib/nakamaClient";

export interface NakamaState {
    session: Session | null;
    socket: Socket | null;
    isConnected: boolean;
    userId: string | null;
    username: string | null;
    error: string | null;
    isAuthenticating: boolean;
}

export function useNakama(): NakamaState {
    const [session, setSession] = useState<Session | null>(null);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const socketRef = useRef<Socket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const authenticate = useCallback(async (): Promise<Session | null> => {
        const username = getStoredUsername();
        if (!username) {
            // Wait for user to set a username — NicknameModal handles this
            return null;
        }

        setIsAuthenticating(true);
        setError(null);

        try {
            const deviceId = getOrCreateDeviceId();
            // authenticateDevice: creates account on first call, logs in on subsequent calls.
            // We pass `create: true` always — Nakama is idempotent here.
            const sess = await client.authenticateDevice(deviceId, true, username);

            // Update username on the account (in case it changed)
            if (username) {
                // Nakama SDK expects display_name
                try {
                    await client.updateAccount(sess, { username, display_name: username });
                } catch (e) {
                    console.warn("Could not update username (might be taken or already set):", e);
                }
            }

            setSession(sess);
            return sess;
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Authentication failed";
            setError(msg);
            console.error("[useNakama] Auth error:", err);
            return null;
        } finally {
            setIsAuthenticating(false);
        }
    }, []);

    const connectSocket = useCallback(
        async (sess: Session): Promise<Socket | null> => {
            try {
                const sock = client.createSocket();
                socketRef.current = sock;

                sock.ondisconnect = () => {
                    setIsConnected(false);
                    console.warn("[useNakama] Socket disconnected — will retry in 3s");
                    // Auto-reconnect
                    reconnectTimer.current = setTimeout(async () => {
                        const freshSess = await authenticate();
                        if (freshSess) {
                            await connectSocket(freshSess);
                        }
                    }, 3000);
                };

                await sock.connect(sess, true); // true = appear online
                setSocket(sock);
                setIsConnected(true);
                return sock;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Socket connection failed";
                setError(msg);
                console.error("[useNakama] Socket error:", err);
                return null;
            }
        },
        [authenticate]
    );

    useEffect(() => {
        let cancelled = false;

        const init = async () => {
            const sess = await authenticate();
            if (!sess || cancelled) return;
            await connectSocket(sess);
        };

        // Only initialise once a username is set
        const username = getStoredUsername();
        if (username) {
            init();
        }

        return () => {
            cancelled = true;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (socketRef.current) {
                socketRef.current.disconnect(false);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount; re-triggered by App when username changes

    return {
        session,
        socket,
        isConnected,
        userId: session?.user_id ?? null,
        username: session?.username ?? null,
        error,
        isAuthenticating,
    };
}
