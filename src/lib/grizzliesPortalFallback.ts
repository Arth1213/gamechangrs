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
  "Supransh Kumar": 3831, "Naman Patil": 3958, "Vivaan Jagtiani": 3881,
  "Kamran Hotak": 4560, "Gary Graham": 5037, "Kristopher Ramsaran": 3950,
  "Vidit Kwatra": 4562, "Rayyan Ketekar": 5298, "Abhishek Paradkar": 3781,
  "Saaket Bapu": 4063, "Aryan Mathur": 4749, "Sahil Garg": 3879,
  "Mohit Nataraj": 3834, "Harish Kakani": 8050, "Adnesh Tondale": 3959,
  "Vedant Jain": 3782, "Muhammad Faisal": 4121,
};

const profileUrls: Record<number, string> = {
  3839: "https://cricclubs.com/NCCA/user/9qyZVOaLX6I2PkRcVHysAg", 8333: "https://cricclubs.com/NCCA/user/_qwQEAsjdr3EvvixA_-zgA", 5013: "https://cricclubs.com/NCCA/user/RRX71jeoqq0idqLUra1Evg", 4503: "https://cricclubs.com/NCCA/user/IdizbTUpqZ2Edlzmp_k7Cw", 3775: "https://cricclubs.com/NCCA/user/P0qEFkSKn8ehLi-INjVX0Q", 3778: "https://cricclubs.com/NCCA/user/kDoBplmQzlP8Jlt56nvykQ", 3913: "https://cricclubs.com/NCCA/user/Y7DO-lLcVC2REgOl_cgqNQ", 7339: "https://cricclubs.com/NCCA/user/mq8AKM6gb104uWpsipmsBQ", 4034: "https://cricclubs.com/NCCA/user/qypP7wP_e61GCg-HaV9q3A", 3882: "https://cricclubs.com/NCCA/user/xOJieC8H9vA_4TkIh6_DdQ", 3883: "https://cricclubs.com/NCCA/user/PHlWiCk-ceDC-dHy-fdFQA", 5009: "https://cricclubs.com/NCCA/user/2ISDMfB9RYsDOGcNSaDgIQ", 8167: "https://cricclubs.com/NCCA/user/HUqXLcCJ3hBgADqblMTLBQ", 3779: "https://cricclubs.com/NCCA/user/cWuTq6vlPP0gC2Baytoxtw", 3800: "https://cricclubs.com/NCCA/user/rQyCNPLz7YEHvD52AJkzFA", 8174: "https://cricclubs.com/NCCA/user/9F9-s5lELTH0jNCaWaIWtA", 4077: "https://cricclubs.com/NCCA/user/CV1n7mcFVRvxzvZ58EwHhg", 3831: "https://cricclubs.com/NCCA/user/5ZD18zExA-uuUof4CFdzjw", 3958: "https://cricclubs.com/NCCA/user/Pvx1We1bRgbUw1QBKN1Ehw", 3881: "https://cricclubs.com/NCCA/user/Ynv9rifmaU0bB8OxMrD4Ww", 4560: "https://cricclubs.com/NCCA/user/Js8hQHJI0tYWrDAsVboJDQ", 5037: "https://cricclubs.com/NCCA/user/h0csM2bmrBZFIbivgZW8WA", 3950: "https://cricclubs.com/NCCA/user/zPdnL5HFLkl8D13963aFNQ", 4562: "https://cricclubs.com/NCCA/user/vuDQwpy5q9DDKX7HQy102A", 5298: "https://cricclubs.com/NCCA/user/6SpnbIVgj9AM2a2kx2BVbg", 3781: "https://cricclubs.com/NCCA/user/ETymOtwZSgQAevE9y1ZuPA", 4063: "https://cricclubs.com/NCCA/user/QR4p6HS7zVKiUZVDnh9wxw", 4749: "https://cricclubs.com/NCCA/user/mTOAIBKktTqX7U6Ud1B3AA", 3879: "https://cricclubs.com/NCCA/user/RP1XEhiRDKaUZkF_7iIRiQ", 3834: "https://cricclubs.com/NCCA/user/n2f70PVcy2-M4U20f5dF-w", 8050: "https://cricclubs.com/NCCA/user/71f3390mDYDmJm1_ubcopQ", 3959: "https://cricclubs.com/NCCA/user/BnWjxFousPUfQWJed01Ptw", 3782: "https://cricclubs.com/NCCA/user/BMx8_cO6DdQ7V_5njshFZA", 4121: "https://cricclubs.com/NCCA/user/VaKKffxm2TTVFksLhGWQbA",
};

const profileOverrides: Record<string, string> = {
  "Aarnav Iyer": "https://cricclubs.com/NCCA/user/8PN7E6MQQ0cHb6MKpNHXpg",
  "Bilal Basheer": "https://cricclubs.com/NCCA/user/aPcCEWPWFTirk5mtFeLaJg",
  "Praneel Venna": "https://cricclubs.com/NCCA/user/LlerDiZTU3eQN_A8Ybki0g",
};

const threatToneByPlayerId: Record<number, "red" | "amber" | "green"> = {
  3775: "green", 3778: "red", 3779: "amber", 3781: "red", 3782: "green", 3800: "green",
  3831: "red", 3834: "green", 3839: "green", 3879: "amber", 3881: "red", 3882: "amber",
  3883: "green", 3913: "red", 3950: "amber", 3958: "red", 3959: "amber", 4034: "green",
  4063: "green", 4077: "amber", 4121: "red", 4503: "red", 4560: "red", 4562: "red",
  4583: "amber", 4749: "green", 5009: "red", 5013: "red", 5037: "amber", 5298: "green",
  7283: "amber", 7339: "green", 7460: "amber", 7991: "amber", 8050: "red", 8167: "green",
  8174: "red", 8333: "green",
};

function threatTone(playerId: number | undefined): "red" | "amber" | "green" | "unknown" {
  return playerId ? threatToneByPlayerId[playerId] || "unknown" : "unknown";
}

function paths(playerId: number, profileUrl = profileUrls[playerId] || null) {
  const query = `series=${SERIES}`;
  return {
    cricclubsProfileUrl: profileUrl,
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
        threatTone: threatTone(playerId),
        ...(playerId ? paths(playerId, profileOverrides[playerName]) : sreehaas ? {
          cricclubsProfileUrl: "https://prod-lm.cricclubs.com/NCCA/viewPlayer.do?playerId=2102795&clubId=1191",
          assessmentPath: null,
          threatPath: null,
        } : { cricclubsProfileUrl: null, assessmentPath: null, threatPath: null }),
      };
    }),
  })),
};
