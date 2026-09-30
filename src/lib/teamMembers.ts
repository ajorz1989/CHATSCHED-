export type ChatSchedTeamMember = {
  name: string;
  title: string;
  bio: string;
  imagePosition: string;
};

const TEAM_SPRITE_SRC = "/team/team-sprite.webp";

export const CHATSCHED_TEAM: ChatSchedTeamMember[] = [
  {
    name: "Ashley Rhodes",
    title: "Brand Head",
    bio: "Ashley shapes ChatSched’s brand direction and how the platform communicates with businesses, publishers and their audiences.",
    imagePosition: "0% 0%",
  },
  {
    name: "John Rhodes",
    title: "Founder & CEO",
    bio: "John leads ChatSched’s vision and company direction, focused on building a simpler way for businesses to buy trusted local advertising.",
    imagePosition: "100% 0%",
  },
  {
    name: "Elizebeth Mawrie",
    title: "Accounts Head",
    bio: "Elizebeth oversees accounts and keeps campaign, client and commercial details organised as advertising moves from request to delivery.",
    imagePosition: "0% 100%",
  },
  {
    name: "Antony Meyer",
    title: "Head of Engineering & Operations",
    bio: "Antony leads engineering and operational delivery, helping keep the platform reliable and the advertising workflow running smoothly.",
    imagePosition: "100% 100%",
  },
];

export { TEAM_SPRITE_SRC };

function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function getTeamMemberForArticle(seed: string): ChatSchedTeamMember {
  return CHATSCHED_TEAM[hashSeed(seed) % CHATSCHED_TEAM.length];
}
