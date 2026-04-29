function normalizeText(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replace(/\s+/g, " ").trim();
}

function normalizeLabel(value) {
  return normalizeText(value).toLowerCase();
}

function classifyPrimaryRole(primaryRole, options = {}) {
  const label = normalizeLabel(primaryRole);
  const wicketkeeper = options.isWicketkeeper === true || /\bwicket\s*keeper\b|\bkeeper\b/.test(label);

  if (wicketkeeper) {
    if (/\ball\s*rounder\b/.test(label)) {
      return "wicketkeeper_all_rounder";
    }

    if (/\bbatter\b|\bbatsman\b|\bbat\b/.test(label)) {
      return "wicketkeeper_batter";
    }

    return "wicketkeeper";
  }

  if (/\ball\s*rounder\b/.test(label)) {
    return "all_rounder";
  }

  if (/\bbowler\b/.test(label)) {
    return "bowler";
  }

  if (/\bbatter\b|\bbatsman\b|\bbat\b/.test(label)) {
    return "batter";
  }

  return "";
}

function classifyBattingStyle(battingStyle) {
  const label = normalizeLabel(battingStyle);

  if (!label) {
    return {
      battingHand: "",
      battingStyleBucket: "",
    };
  }

  if (/\bleft\b/.test(label)) {
    return {
      battingHand: "left",
      battingStyleBucket: "left_hand_batter",
    };
  }

  if (/\bright\b/.test(label)) {
    return {
      battingHand: "right",
      battingStyleBucket: "right_hand_batter",
    };
  }

  return {
    battingHand: "",
    battingStyleBucket: "",
  };
}

function buildPaceDetail(arm, label) {
  const speed =
    /\bfast\b/.test(label) && /\bmedium\b/.test(label)
      ? "fast_medium"
      : /\bmedium\b/.test(label) && /\bfast\b/.test(label)
        ? "medium_fast"
        : /\bfast\b/.test(label)
          ? "fast"
          : /\bmedium\b/.test(label)
            ? "medium"
            : /\bpace\b/.test(label) || /\bseam\b/.test(label)
              ? "pace"
              : "pace";

  if (arm) {
    return `${arm}_arm_${speed}`;
  }

  return speed;
}

function classifyBowlingStyle(bowlingStyle) {
  const label = normalizeLabel(bowlingStyle);
  const arm = /\bleft arm\b/.test(label)
    ? "left"
    : /\bright arm\b/.test(label)
      ? "right"
      : "";

  if (!label || /\bnone\b|\bn\/a\b|\bna\b|\bdoes not bowl\b/.test(label)) {
    return {
      bowlingArm: arm,
      bowlingStyleBucket: "",
      bowlingStyleDetail: "",
    };
  }

  if (
    /\boff\s*spin\b|\boffbreak\b|\boff break\b|\boff-spinner\b|\boff spinner\b/.test(label)
  ) {
    return {
      bowlingArm: arm,
      bowlingStyleBucket: arm === "left" ? "left_arm_spinner" : "off_spinner",
      bowlingStyleDetail: arm ? `${arm}_arm_off_spin` : "off_spin",
    };
  }

  if (
    /\bleg\s*spin\b|\blegbreak\b|\bleg break\b|\bleg-spinner\b|\bleg spinner\b|\bgoogly\b/.test(
      label
    )
  ) {
    return {
      bowlingArm: arm,
      bowlingStyleBucket: "leg_spinner",
      bowlingStyleDetail: arm ? `${arm}_arm_leg_spin` : "leg_spin",
    };
  }

  if (
    /\bslow left arm orthodox\b|\bleft arm spin\b|\bleft-arm spin\b|\bleft arm unorthodox\b|\bchinaman\b|\bleft arm wrist spin\b/.test(
      label
    )
  ) {
    return {
      bowlingArm: arm || "left",
      bowlingStyleBucket: "left_arm_spinner",
      bowlingStyleDetail: /\bunorthodox\b/.test(label)
        ? "left_arm_unorthodox"
        : /\bwrist\b|\bchinaman\b/.test(label)
          ? "left_arm_wrist_spin"
        : "left_arm_spin",
    };
  }

  if (/\bfast\b|\bmedium\b|\bpace\b|\bseam\b/.test(label)) {
    return {
      bowlingArm: arm,
      bowlingStyleBucket: arm === "left" ? "left_arm_pace" : arm === "right" ? "right_arm_pace" : "pace",
      bowlingStyleDetail: buildPaceDetail(arm, label),
    };
  }

  if (/\bspin\b/.test(label)) {
    return {
      bowlingArm: arm,
      bowlingStyleBucket: arm === "left" ? "left_arm_spinner" : "spinner",
      bowlingStyleDetail: arm ? `${arm}_arm_spin` : "spin",
    };
  }

  return {
    bowlingArm: arm,
    bowlingStyleBucket: "",
    bowlingStyleDetail: arm ? `${arm}_arm_unknown` : "",
  };
}

function normalizePlayerProfile(profile = {}, options = {}) {
  const primaryRole = normalizeText(profile.primaryRole);
  const battingStyle = normalizeText(profile.battingStyle);
  const bowlingStyle = normalizeText(profile.bowlingStyle);
  const primaryRoleBucket = classifyPrimaryRole(primaryRole, options);
  const batting = classifyBattingStyle(battingStyle);
  const bowling = classifyBowlingStyle(bowlingStyle);

  return {
    primaryRole,
    primaryRoleBucket,
    battingStyle,
    battingHand: batting.battingHand,
    battingStyleBucket: batting.battingStyleBucket,
    bowlingStyle,
    bowlingArm: bowling.bowlingArm,
    bowlingStyleBucket: bowling.bowlingStyleBucket,
    bowlingStyleDetail: bowling.bowlingStyleDetail,
  };
}

module.exports = {
  normalizePlayerProfile,
  normalizeText,
};
