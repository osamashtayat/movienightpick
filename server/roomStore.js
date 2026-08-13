class RoomStoreError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "RoomStoreError";
    this.status = status;
  }
}

const memory = globalThis.__movieNightPickRooms || {
  rooms: new Map(),
  members: new Map(),
  votes: new Map(),
  submissions: new Map(),
};
globalThis.__movieNightPickRooms = memory;
if (!memory.submissions) memory.submissions = new Map();

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function roomMembers(code) {
  if (!memory.members.has(code)) memory.members.set(code, []);
  return memory.members.get(code);
}

function roomVotes(code) {
  if (!memory.votes.has(code)) memory.votes.set(code, []);
  return memory.votes.get(code);
}

function roomSubmissions(code) {
  if (!memory.submissions.has(code)) memory.submissions.set(code, []);
  return memory.submissions.get(code);
}

function memoryStore() {
  return {
    kind: "memory",
    async insertRoom(room) {
      if (memory.rooms.has(room.code)) throw new RoomStoreError("Room code collision.", 409);
      memory.rooms.set(room.code, clone(room));
      return clone(room);
    },
    async getRoom(code) {
      return clone(memory.rooms.get(code) || null);
    },
    async updateRoom(code, changes) {
      const current = memory.rooms.get(code);
      if (!current) return null;
      const next = { ...current, ...clone(changes), updated_at: new Date().toISOString() };
      memory.rooms.set(code, next);
      return clone(next);
    },
    async deleteRoom(code) {
      memory.rooms.delete(code);
      memory.members.delete(code);
      memory.votes.delete(code);
      memory.submissions.delete(code);
    },
    async deleteExpiredRooms(now) {
      [...memory.rooms.values()]
        .filter((room) => Date.parse(room.expires_at) <= Date.parse(now))
        .forEach((room) => {
          memory.rooms.delete(room.code);
          memory.members.delete(room.code);
          memory.votes.delete(room.code);
          memory.submissions.delete(room.code);
        });
    },
    async insertMember(member) {
      const members = roomMembers(member.room_code);
      if (members.some((item) => item.id === member.id)) {
        throw new RoomStoreError("Member already exists.", 409);
      }
      members.push(clone(member));
      return clone(member);
    },
    async getMembers(code) {
      return clone(roomMembers(code));
    },
    async getVotes(code) {
      return clone(roomVotes(code));
    },
    async upsertVote(vote) {
      const votes = roomVotes(vote.room_code);
      const existingIndex = votes.findIndex((item) => item.member_id === vote.member_id);
      if (existingIndex >= 0) votes[existingIndex] = clone(vote);
      else votes.push(clone(vote));
      return clone(vote);
    },
    async deleteVotes(code) {
      memory.votes.set(code, []);
    },
    async getSubmissions(code) {
      return clone(roomSubmissions(code));
    },
    async upsertSubmission(submission) {
      const submissions = roomSubmissions(submission.room_code);
      const existingIndex = submissions.findIndex(
        (item) => item.member_id === submission.member_id
      );
      if (existingIndex >= 0) submissions[existingIndex] = clone(submission);
      else submissions.push(clone(submission));
      return clone(submission);
    },
    async deleteSubmissions(code) {
      memory.submissions.set(code, []);
    },
  };
}

async function supabaseFetch(path, { method = "GET", body, prefer } = {}) {
  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const legacyJwtHeaders = serviceKey?.startsWith("eyJ")
    ? { Authorization: `Bearer ${serviceKey}` }
    : {};
  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: serviceKey,
      ...legacyJwtHeaders,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const duplicate = response.status === 409 || payload?.code === "23505";
    throw new RoomStoreError(
      duplicate ? "Room code collision." : "The room database is unavailable.",
      duplicate ? 409 : 503
    );
  }

  return payload;
}

function supabaseStore() {
  return {
    kind: "supabase",
    async insertRoom(room) {
      const [created] = await supabaseFetch("movie_rooms", {
        method: "POST",
        body: room,
        prefer: "return=representation",
      });
      return created;
    },
    async getRoom(code) {
      const rooms = await supabaseFetch(
        `movie_rooms?code=eq.${encodeURIComponent(code)}&select=*&limit=1`
      );
      return rooms?.[0] || null;
    },
    async updateRoom(code, changes) {
      const rooms = await supabaseFetch(
        `movie_rooms?code=eq.${encodeURIComponent(code)}`,
        {
          method: "PATCH",
          body: changes,
          prefer: "return=representation",
        }
      );
      return rooms?.[0] || null;
    },
    async deleteRoom(code) {
      await supabaseFetch(`movie_rooms?code=eq.${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
    },
    async deleteExpiredRooms(now) {
      await supabaseFetch(`movie_rooms?expires_at=lt.${encodeURIComponent(now)}`, {
        method: "DELETE",
      });
    },
    async insertMember(member) {
      const [created] = await supabaseFetch("movie_room_members", {
        method: "POST",
        body: member,
        prefer: "return=representation",
      });
      return created;
    },
    async getMembers(code) {
      return supabaseFetch(
        `movie_room_members?room_code=eq.${encodeURIComponent(code)}&select=*&order=joined_at.asc`
      );
    },
    async getVotes(code) {
      return supabaseFetch(
        `movie_room_votes?room_code=eq.${encodeURIComponent(code)}&select=*`
      );
    },
    async upsertVote(vote) {
      const [saved] = await supabaseFetch("movie_room_votes?on_conflict=room_code,member_id", {
        method: "POST",
        body: vote,
        prefer: "resolution=merge-duplicates,return=representation",
      });
      return saved;
    },
    async deleteVotes(code) {
      await supabaseFetch(`movie_room_votes?room_code=eq.${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
    },
    async getSubmissions(code) {
      return supabaseFetch(
        `movie_room_submissions?room_code=eq.${encodeURIComponent(code)}&select=*&order=updated_at.asc`
      );
    },
    async upsertSubmission(submission) {
      const [saved] = await supabaseFetch(
        "movie_room_submissions?on_conflict=room_code,member_id",
        {
          method: "POST",
          body: submission,
          prefer: "resolution=merge-duplicates,return=representation",
        }
      );
      return saved;
    },
    async deleteSubmissions(code) {
      await supabaseFetch(
        `movie_room_submissions?room_code=eq.${encodeURIComponent(code)}`,
        { method: "DELETE" }
      );
    },
  };
}

function roomStore() {
  const hasSupabaseKey = process.env.SUPABASE_SECRET_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.SUPABASE_URL && hasSupabaseKey) {
    return supabaseStore();
  }

  if (process.env.VERCEL_ENV === "production") {
    throw new RoomStoreError("Group rooms are not configured yet.", 503);
  }

  return memoryStore();
}

function resetMemoryRoomStore() {
  memory.rooms.clear();
  memory.members.clear();
  memory.votes.clear();
  memory.submissions.clear();
}

module.exports = {
  RoomStoreError,
  resetMemoryRoomStore,
  roomStore,
};
