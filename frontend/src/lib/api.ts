import { z } from 'zod';

const API_BASE_URL = '/api'; // Vite proxy will handle this

// --- Zod Schemas for API validation ---

const ThreadSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  summary: z.string().nullable(),
});

export type Thread = z.infer<typeof ThreadSchema>;

const MessageSchema = z.object({
    id: z.string(),
    thread_id: z.string(),
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
    tokens: z.number().nullable(),
    created_at: z.string().datetime(),
});

export type Message = z.infer<typeof MessageSchema>;

const ThreadWithMessagesSchema = ThreadSchema.extend({
    messages: z.array(MessageSchema),
});

export type ThreadWithMessages = z.infer<typeof ThreadWithMessagesSchema>;


// --- API Fetching Functions ---

export async function getThreads(query: string = ''): Promise<Thread[]> {
    const url = query ? `${API_BASE_URL}/threads?q=${query}` : `${API_BASE_URL}/threads`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error('Failed to fetch threads');
    }
    const data = await response.json();
    return z.array(ThreadSchema).parse(data);
}

export async function getThread(threadId: string): Promise<ThreadWithMessages> {
    const response = await fetch(`${API_BASE_URL}/threads/${threadId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch thread');
    }
    const data = await response.json();
    return ThreadWithMessagesSchema.parse(data);
}

export async function createThread(): Promise<Thread> {
    const response = await fetch(`${API_BASE_URL}/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thread' }), // Default title
    });
    if (!response.ok) {
        throw new Error('Failed to create thread');
    }
    const data = await response.json();
    return ThreadSchema.parse(data);
}

export async function postMessage(threadId: string, content: string) {
    // This function will be special because it deals with a stream.
    // We'll return the raw response object for the caller to handle.
    const response = await fetch(`${API_BASE_URL}/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
    });

    if (!response.ok || !response.body) {
        throw new Error('Failed to post message or get response body');
    }
    return response;
}
