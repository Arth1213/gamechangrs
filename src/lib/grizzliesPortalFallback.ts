import type { CricketGrizzliesPortalResponse } from "@/lib/cricketApi";

const SERIES = "bay-area-youth-cricket-hub-2026-ncca-2026-summer-6e89aakq-kwupu80epy0a";

type RosterRow = readonly [name: string, rosterCategory: string];

const roster: Record<string, readonly RosterRow[]> = {
  "Silicon Valley Strikers": [
    ["Carmi Le Roux", "Wildcard"], ["Shehan Jayasuriya", "Domestic WC"], ["Vivaan Jagtiani", "U21"], ["Naman Patil", "U21"], ["Amogh Arepally", "U19"], ["Yosuf Zazai", "Domestic R"], ["Kamran Hotak", "Domestic R"], ["Gary Graham", "Domestic R"], ["Saurabh Netravalkar", "Domestic R"], ["Kristopher Ramsaran", "Domestic R"], ["Aarnav Iyer", "Domestic"], ["Nisarulhaq Wahdat", "Domestic"], ["Bilal Basheer", "Domestic"], ["Vidit Kwatra", "Domestic"], ["Praneel Venna", "Domestic"], ["Ramesh Basnet", "Domestic"], ["Vinay Khandelwal", "Free Agent optional"], ["Kashyap Manchili", "Free Agent optional"],
  ],
  "East Bay Blazers": [
    ["Angelo Perera", "Wildcard"], ["Sanjay Krishnamurthi", "Domestic WC"], ["Advaith Dhumal Rao", "U19"], ["Rayyan Ketekar", "U19"], ["Syon Kurdekar", "U19"], ["Abhishek Paradkar", "Domestic R"], ["Faisal Khan Ahmadzai", "Domestic R"], ["Hezbullah Durrani", "Domestic R"], ["Saideep Ganesh", "Domestic R"], ["Suliman Arabzai", "Domestic R"], ["Aakash Sudareshan", "Domestic"], ["Sidhant Reddy", "Domestic"], ["Mohammad Katawazai", "Domestic"], ["Avyukth Raghunarayan", "Domestic"], ["Aadhav Iyer", "Domestic"], ["Ayaan Khan", "Domestic"], ["Saaket Bapu", "Free Agent optional"], ["Aryan Mathur", "Free Agent optional"],
  ],
  "San Ramon Grizzlies": [
    ["Husnain Bukhari", "Wildcard"], ["Shivam Mishra", "Domestic WC"], ["Supransh Kumar", "U19"], ["Sahil Garg", "U19"], ["Aryan Sidhu", "U19"], ["Vatsal Vaghela", "Domestic R"], ["Mohit Nataraj", "Domestic R"], ["Rahul Jariwala", "Domestic R"], ["Harish Kakani", "Domestic R"], ["Ayan Desai", "Domestic R"], ["Zahid Zakhil", "Domestic"], ["Adnesh Tondale", "Domestic"], ["Vedant Jain", "Domestic"], ["Muhammad Faisal", "Domestic"], ["Sreehaas Krishna", "Domestic"],
  ],
};

// Only identities approved by the roster reconciliation are linked. This is a
// presentation fallback; the API remains the authority once deployed.
const playerIds: Record<string, number> = {
  "Amogh Arepally": 3839, "Saurabh Netravalkar": 8333, "Nisarulhaq Wahdat": 5013,
  "Ramesh Basnet": 4503, "Syon Kurdekar": 3775, "Saideep Ganesh": 3778,
  "Suliman Arabzai": 3913, "Sidhant Reddy": 7339, "Avyukth Raghunarayan": 4034,
  "Vatsal Vaghela": 3882, "Rahul Jariwala": 3883, "Zahid Zakhil": 5009,
  "Kashyap Manchili": 7283, "Aarnav Iyer": 7460, "Bilal Basheer": 7991,
  "Praneel Venna": 4583, "Vinay Khandelwal": 8167, "Aadhav Iyer": 3779,
  "Ayaan Khan": 3800, "Husnain Bukhari": 8174, "Shivam Mishra": 4077,
  "Supransh Kumar": 3831,
};

function paths(playerId: number) {
  const query = `series=${SERIES}`;
  return {
    cricclubsProfileUrl: `https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=${playerId}&clubId=1191`,
    assessmentPath: `/analytics/reports/${playerId}?${query}`,
    threatPath: `/analytics/intelligence/${playerId}?${query}`,
  };
}

export const grizzliesPortalFallback: CricketGrizzliesPortalResponse = {
  title: "Grizzlies 2026 Analytics",
  nccaSeriesConfigKey: SERIES,
  analysisStatus: "Match Analysis and AI Recommendations Coming Soon",
  teams: Object.entries(roster).map(([name, players]) => ({
    name,
    players: players.map(([playerName, rosterCategory]) => {
      const playerId = playerIds[playerName];
      const sreehaas = playerName === "Sreehaas Krishna";
      return {
        name: playerName,
        rosterCategory,
        nccaStatus: playerId || sreehaas ? "matched" : "not_found",
        ...(playerId ? paths(playerId) : sreehaas ? {
          cricclubsProfileUrl: "https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=2102795&clubId=1191",
          assessmentPath: null,
          threatPath: null,
        } : { cricclubsProfileUrl: null, assessmentPath: null, threatPath: null }),
      };
    }),
  })),
};
