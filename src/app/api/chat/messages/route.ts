import { NextRequest, NextResponse } from 'next/server';
import { getDB, ChatMessage } from '@/lib/db';

export const dynamic = 'force-dynamic';

const MAX_MESSAGE_LENGTH = 500;
const MAX_USERNAME_LENGTH = 24;
const USERNAME_REGEX = /^[a-zA-Z0-9_\-. ]{1,24}$/;

// GET /api/chat/messages?after=<id>&limit=<n>
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const afterId = parseInt(searchParams.get('after') ?? '0');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 100);

    const db = getDB();

    let messages: ChatMessage[];
    if (afterId > 0) {
      messages = db
        .prepare(
          `SELECT * FROM chat_messages WHERE id > ? ORDER BY id ASC LIMIT ?`
        )
        .all(afterId, limit) as ChatMessage[];
    } else {
      // Initial load: return last N messages in chronological order
      messages = db
        .prepare(
          `SELECT * FROM (
            SELECT * FROM chat_messages ORDER BY id DESC LIMIT ?
          ) ORDER BY id ASC`
        )
        .all(limit) as ChatMessage[];
    }

    return NextResponse.json({ messages });
  } catch (err) {
    console.error('GET /api/chat/messages error:', err);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST /api/chat/messages  body: { username, message }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = String(body.username ?? '').trim();
    const message = String(body.message ?? '').trim();

    if (!username || !USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: 'Invalid username. Use letters, numbers, _, -, . (max 24 chars).' },
        { status: 400 }
      );
    }

    if (!message || message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be 1–${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const db = getDB();

    const result = db
      .prepare(`INSERT INTO chat_messages (username, message) VALUES (?, ?)`)
      .run(username.slice(0, MAX_USERNAME_LENGTH), message.slice(0, MAX_MESSAGE_LENGTH));

    const inserted = db
      .prepare(`SELECT * FROM chat_messages WHERE id = ?`)
      .get(result.lastInsertRowid) as ChatMessage;

    return NextResponse.json({ message: inserted }, { status: 201 });
  } catch (err) {
    console.error('POST /api/chat/messages error:', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
